import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * Acute Kidney Injury PDF Template - March 2026
 * Professional Black & White Format for Printing (US Letter)
 *
 * Anti-orphaning: Section titles INSIDE fieldBox
 * wrap={false} conditional on fieldBox
 * NO borderBottom on sectionTitle
 * Record header always wrap={false}
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

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 12,
    lineHeight: 1.5,
    backgroundColor: '#ffffff',
    color: '#000000',
  },
  documentHeader: {
    marginBottom: 24,
    paddingBottom: 14,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  recordContainer: {
    marginBottom: 28,
    paddingBottom: 20,
  },
  recordHeader: {
    marginBottom: 16,
  },
  recordTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
  },
  recordDate: {
    fontSize: 10,
    color: '#000000',
    marginTop: 4,
  },
  section: {
    marginBottom: 10,
  },
  fieldBox: {
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fieldLabel: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  fieldValue: {
    fontSize: 11,
    fontFamily: 'Helvetica',
    color: '#000000',
    lineHeight: 1.4,
  },
  listItem: {
    fontSize: 11,
    fontFamily: 'Helvetica',
    color: '#000000',
    lineHeight: 1.5,
    marginBottom: 2,
    paddingLeft: 8,
  },
  emptyState: {
    textAlign: 'center',
    padding: 40,
    color: '#000000',
  },
});

const splitIntoSentences = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<=[.!?;])\s+/).filter(s => s.trim().length > 0).map(s => s.trim());
};

const hasValue = (val) => val !== null && val !== undefined && val !== '';

const KEY_OVERRIDES = {
  fenA: 'FENa',
  feUrea: 'FEUrea',
  bun: 'BUN',
  egfr: 'eGFR',
  uOsm: 'Urine Osmolality',
  sOsm: 'Serum Osmolality',
};

const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key];
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const isObjEmptyDeep = (v) => {
  if (v === null || v === undefined) return true;
  if (typeof v === 'boolean') return false;
  if (typeof v === 'number') return !Number.isFinite(v);
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.filter(x => !isObjEmptyDeep(x)).length === 0;
  if (typeof v === 'object') return Object.values(v).every(isObjEmptyDeep);
  return false;
};

const formatDate = (dateVal) => {
  if (!dateVal) return '';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return String(dateVal);
  }
};

const AcuteKidneyInjuryDocumentPDFTemplate = ({ document: docProp, data }) => {
  const templateData = docProp || data;

  let records = [];
  if (templateData) {
    if (templateData.acute_kidney_injury) {
      const raw = templateData.acute_kidney_injury;
      records = Array.isArray(raw) ? raw : [raw];
    } else if (Array.isArray(templateData)) {
      records = templateData;
    } else if (templateData.documentData) {
      const docData = templateData.documentData;
      if (Array.isArray(docData)) records = docData;
      else if (docData.acute_kidney_injury) {
        const raw = docData.acute_kidney_injury;
        records = Array.isArray(raw) ? raw : [raw];
      } else records = [docData];
    } else {
      records = [templateData];
    }
  }

  /**
   * Render a section with simple key-value fields.
   * Anti-orphan: sectionTitle INSIDE fieldBox, wrap={false}.
   */
  const renderSection = (sectionTitle, fields, keyPrefix) => {
    const visibleFields = fields.filter(([, val]) => hasValue(val));
    if (visibleFields.length === 0) return null;

    return (
      <View key={keyPrefix} style={styles.section}>
        <View style={styles.fieldBox} wrap={visibleFields.length > 8 ? undefined : false}>
          <Text style={styles.sectionTitle}>{safeString(sectionTitle)}</Text>
          {visibleFields.map(([label, value], i) => (
            <View key={`${keyPrefix}-${i}`} style={{ flexDirection: 'row', marginBottom: 3 }}>
              <Text style={styles.fieldLabel}>{safeString(label)}: </Text>
              <Text style={styles.fieldValue}>{safeString(String(value))}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  /**
   * Render a section with sentence-split text content.
   * Anti-orphan: sectionTitle INSIDE fieldBox, wrap conditional on item count.
   */
  const renderSentenceSection = (sectionTitle, label, text, keyPrefix) => {
    const sentences = splitIntoSentences(text);
    if (sentences.length === 0) return null;
    // Hide the field label when it duplicates the section title (case-insensitive)
    const showLabel = label && String(label).trim().toLowerCase() !== String(sectionTitle).trim().toLowerCase();

    return (
      <View key={keyPrefix} style={styles.section}>
        <View style={styles.fieldBox} wrap={sentences.length > 8 ? undefined : false}>
          <Text style={styles.sectionTitle}>{safeString(sectionTitle)}</Text>
          {showLabel ? <Text style={styles.fieldLabel}>{safeString(label)}</Text> : null}
          {sentences.map((s, i) => (
            <Text key={i} style={styles.listItem}>{i + 1}. {safeString(s)}</Text>
          ))}
        </View>
      </View>
    );
  };

  /**
   * Render an array section (precipitants, recommendations).
   * Anti-orphan: sectionTitle INSIDE fieldBox, wrap conditional on item count.
   */
  const renderArraySection = (sectionTitle, label, items, keyPrefix) => {
    if (!items || items.length === 0) return null;
    // Hide the field label when it duplicates the section title (case-insensitive)
    const showLabel = label && String(label).trim().toLowerCase() !== String(sectionTitle).trim().toLowerCase();

    return (
      <View key={keyPrefix} style={styles.section}>
        <View style={styles.fieldBox} wrap={items.length > 8 ? undefined : false}>
          <Text style={styles.sectionTitle}>{safeString(sectionTitle)}</Text>
          {showLabel ? <Text style={styles.fieldLabel}>{safeString(label)}</Text> : null}
          {items.map((item, i) => {
            const text = typeof item === 'string' ? item : item.recommendation || '';
            return (
              <Text key={i} style={styles.listItem}>{i + 1}. {safeString(text)}</Text>
            );
          })}
        </View>
      </View>
    );
  };

  /**
   * Recursively flatten an object into indented label/value lines.
   */
  const objectLines = (value, depth = 0, label = '') => {
    const out = [];
    const empty = (v) => {
      if (v === null || v === undefined) return true;
      if (typeof v === 'boolean') return false;
      if (typeof v === 'number') return !Number.isFinite(v);
      if (typeof v === 'string') return v.trim() === '';
      if (Array.isArray(v)) return v.filter(x => !empty(x)).length === 0;
      if (typeof v === 'object') return Object.values(v).every(empty);
      return false;
    };
    const fmt = (v) => (typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v ?? ''));
    if (empty(value)) return out;
    if (value === null || typeof value !== 'object') {
      out.push({ depth, label, value: fmt(value) });
      return out;
    }
    if (label) out.push({ depth, label, value: null });
    Object.entries(value).filter(([, v]) => !empty(v)).forEach(([k, v]) => {
      out.push(...objectLines(v, depth + (label ? 1 : 0), humanizeKey(k)));
    });
    return out;
  };

  /**
   * Render an OBJECT field section (urinaryIndices, results).
   * Anti-orphan: sectionTitle INSIDE fieldBox, wrap conditional on line count.
   */
  const renderObjectSection = (sectionTitle, value, keyPrefix) => {
    const lines = objectLines(value, 0, '');
    if (lines.length === 0) return null;

    return (
      <View key={keyPrefix} style={styles.section}>
        <View style={styles.fieldBox} wrap={lines.length > 8 ? undefined : false}>
          <Text style={styles.sectionTitle}>{safeString(sectionTitle)}</Text>
          {lines.map((ln, i) => (
            <View key={`${keyPrefix}-${i}`} style={{ flexDirection: 'row', marginBottom: 3, paddingLeft: 8 * ln.depth }}>
              {ln.value === null ? (
                <Text style={styles.fieldLabel}>{safeString(ln.label)}</Text>
              ) : (
                <>
                  <Text style={styles.fieldLabel}>{safeString(ln.label)}: </Text>
                  <Text style={styles.fieldValue}>{safeString(ln.value)}</Text>
                </>
              )}
            </View>
          ))}
        </View>
      </View>
    );
  };

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.title}>Acute Kidney Injury Report</Text>
          </View>
          <Text style={styles.emptyState}>No acute kidney injury records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.title}>Acute Kidney Injury Report</Text>
        </View>

        {records.map((record, idx) => {
          const recordTitle = record._documentTitle || `AKI Assessment ${idx + 1}`;

          return (
            <View key={record._id || idx} style={styles.recordContainer}>
              {/* Record Header — always wrap={false} */}
              <View style={styles.recordHeader} wrap={false}>
                <Text style={styles.recordTitle}>{safeString(recordTitle)}</Text>
                {(record.date || record.stage) && (
                  <Text style={styles.recordDate}>
                    {record.date ? formatDate(record.date) : ''}
                    {record.date && record.stage ? ' | ' : ''}
                    {record.stage ? `Stage: ${safeString(record.stage)}` : ''}
                  </Text>
                )}
              </View>

              {/* AKI Parameters */}
              {renderSection('AKI Parameters', [
                ['Baseline Creatinine', record.baselineCreatinine],
                ['Peak Creatinine', record.peakCreatinine],
                ['Urine Output', record.urineOutput],
                ['Stage', record.stage],
              ], `aki-params-${idx}`)}

              {/* Etiology — sentence split */}
              {hasValue(record.etiology) && renderSentenceSection(
                'Etiology', 'Etiology', record.etiology, `etiology-${idx}`
              )}

              {/* Precipitants — array */}
              {renderArraySection('Precipitants', 'Precipitants', record.precipitants, `precipitants-${idx}`)}

              {/* Labs & Indices — fenA, feUrea (string with units) */}
              {renderSection('Labs & Indices', [
                ['FENa', record.fenA],
                ['FEUrea', record.feUrea],
              ], `labs-indices-${idx}`)}

              {/* Urinary Indices — object */}
              {!isObjEmptyDeep(record.urinaryIndices) && renderObjectSection(
                'Urinary Indices', record.urinaryIndices, `urinary-indices-${idx}`
              )}

              {/* Recovery & Dialysis */}
              {renderSection('Recovery & Dialysis', [
                ['Recovery', record.recovery],
                ['Dialysis Required', record.dialysisRequired === true ? 'Yes' : record.dialysisRequired === false ? 'No' : ''],
              ], `recovery-${idx}`)}

              {/* Provider Details */}
              {renderSection('Provider Details', [
                ['Provider', record.provider],
                ['Facility', record.facility],
              ], `provider-${idx}`)}

              {/* Findings — sentence split */}
              {hasValue(record.findings) && renderSentenceSection(
                'Findings', 'Findings', record.findings, `findings-${idx}`
              )}

              {/* Results — object */}
              {!isObjEmptyDeep(record.results) && renderObjectSection(
                'Results', record.results, `results-${idx}`
              )}

              {/* Assessment — sentence split */}
              {hasValue(record.assessment) && renderSentenceSection(
                'Assessment', 'Assessment', record.assessment, `assessment-${idx}`
              )}

              {/* Plan — sentence split */}
              {hasValue(record.plan) && renderSentenceSection(
                'Plan', 'Plan', record.plan, `plan-${idx}`
              )}

              {/* Notes — sentence split */}
              {hasValue(record.notes) && renderSentenceSection(
                'Notes', 'Notes', record.notes, `notes-${idx}`
              )}

              {/* Recommendations — array */}
              {renderArraySection('Recommendations', 'Recommendations', record.recommendations, `recommendations-${idx}`)}

              {/* Status */}
              {hasValue(record.status) && renderSection('Status', [
                ['Status', record.status],
              ], `status-${idx}`)}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default AcuteKidneyInjuryDocumentPDFTemplate;
