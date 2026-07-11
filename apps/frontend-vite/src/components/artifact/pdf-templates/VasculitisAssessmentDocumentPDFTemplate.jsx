import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * VasculitisAssessmentDocumentPDFTemplate
 * March 2026 — Helvetica, LETTER size, 20pt/12pt
 */

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 12,
    lineHeight: 1.5,
    color: '#000000',
  },
  documentHeader: {
    marginBottom: 24,
    borderBottomWidth: 3,
    borderBottomColor: '#000000',
    paddingBottom: 14,
  },
  documentTitle: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    textTransform: 'uppercase',
    letterSpacing: 2,
    textAlign: 'center',
  },
  documentSubtitle: {
    fontSize: 10,
    color: '#555555',
    textAlign: 'center',
    marginTop: 4,
  },
  generatedDate: {
    fontSize: 9,
    color: '#555555',
    textAlign: 'right',
    marginTop: 6,
  },
  recordContainer: {
    marginBottom: 24,
  },
  recordHeader: {
    marginBottom: 16,
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderWidth: 2,
    borderColor: '#000000',
    borderLeftWidth: 5,
    borderLeftColor: '#000000',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recordTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dateBadge: {
    fontSize: 9,
    color: '#000000',
    backgroundColor: '#e0e0e0',
    padding: 4,
    paddingLeft: 8,
    paddingRight: 8,
  },
  statusBadge: {
    fontSize: 9,
    color: '#000000',
    backgroundColor: '#e0e0e0',
    padding: 4,
    paddingLeft: 8,
    paddingRight: 8,
    borderWidth: 1,
    borderColor: '#000000',
  },
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    textTransform: 'uppercase',
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
  },
  fieldBox: {
    borderWidth: 1,
    borderColor: '#cccccc',
    marginBottom: 6,
    padding: 8,
    paddingBottom: 6,
    backgroundColor: '#fafafa',
  },
  fieldLabel: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#333333',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  numberedItem: {
    flexDirection: 'row',
    marginBottom: 4,
    paddingLeft: 4,
  },
  itemNumber: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#333333',
    width: 20,
  },
  itemContent: {
    fontSize: 12,
    color: '#000000',
    flex: 1,
    lineHeight: 1.4,
  },
  providerSection: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#000000',
  },
  providerGrid: {
    flexDirection: 'row',
    gap: 20,
  },
  providerItem: {
    flex: 1,
  },
  providerLabel: {
    fontSize: 9,
    color: '#333333',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  providerValue: {
    fontSize: 12,
    color: '#000000',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 8,
    color: '#999999',
    borderTopWidth: 1,
    borderTopColor: '#cccccc',
    paddingTop: 6,
  },
  noRecords: {
    textAlign: 'center',
    padding: 40,
    color: '#333333',
    fontSize: 12,
  },
});

const formatDate = (dateString) => {
  if (!dateString) return '';
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  } catch { return String(dateString); }
};

const formatDateShort = (dateString) => {
  if (!dateString) return '';
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  } catch { return String(dateString); }
};

const safeString = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  return String(val);
};

const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.(?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};

const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) { const t = current.trim(); if (t) result.push(t); current = ''; }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

const safeArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [value];
};

/* humanizeKey for dynamic-key `results` object */
const KEY_OVERRIDES = {
  anca: 'ANCA', pr3: 'PR3', mpo: 'MPO', esr: 'ESR', crp: 'CRP', bvas: 'BVAS',
  vdi: 'VDI', gpa: 'GPA', egpa: 'EGPA', mpa: 'MPA', pan: 'PAN', anca_serology: 'ANCA Serology',
  igg: 'IgG', iga: 'IgA', igm: 'IgM', c3: 'C3', c4: 'C4', anti_gbm: 'Anti-GBM',
};
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  const lower = String(key).toLowerCase();
  if (KEY_OVERRIDES[lower]) return KEY_OVERRIDES[lower];
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
/* recursive flatten — dotted labels, no [object Object] */
const flattenResults = (obj, prefix = '') => {
  const items = [];
  if (!obj || typeof obj !== 'object') return items;
  Object.entries(obj).forEach(([k, v]) => {
    if (isEmptyDeep(v)) return;
    const label = prefix ? `${prefix} - ${humanizeKey(k)}` : humanizeKey(k);
    if (v === null || typeof v !== 'object') {
      items.push({ label, value: fmtScalar(v) });
    } else if (Array.isArray(v)) {
      const scalars = v.filter(x => !isEmptyDeep(x) && (x === null || typeof x !== 'object'));
      if (scalars.length === v.filter(x => !isEmptyDeep(x)).length) {
        items.push({ label, value: scalars.map(fmtScalar).join(', ') });
      } else {
        v.filter(x => !isEmptyDeep(x)).forEach((x, i) => {
          if (x === null || typeof x !== 'object') items.push({ label: `${label} ${i + 1}`, value: fmtScalar(x) });
          else items.push(...flattenResults(x, `${label} ${i + 1}`));
        });
      }
    } else {
      items.push(...flattenResults(v, label));
    }
  });
  return items;
};

/* Field section with fieldBox layout */
const FieldSection = ({ title, fields }) => {
  const validFields = fields.filter(([, v]) => v);
  if (validFields.length === 0) return null;

  return (
    <View style={styles.section} wrap={validFields.length > 8 ? undefined : false}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {validFields.map(([label, val], idx) => {
        const strVal = safeString(val);
        const sentences = splitBySentence(strVal);
        if (sentences.length > 1) {
          return (
            <View key={idx}>
              <View style={styles.fieldBox}>
                <Text style={styles.fieldLabel}>{label}</Text>
                {sentences.map((s, sIdx) => {
                  const parsed = parseLabel(s);
                  if (parsed.isLabeled) {
                    const commaItems = splitByComma(parsed.value);
                    if (commaItems.length >= 2) {
                      return (
                        <View key={sIdx}>
                          <Text style={[styles.fieldLabel, { fontSize: 9, marginTop: 4 }]}>{parsed.label}</Text>
                          {commaItems.map((ci, ciIdx) => (
                            <View key={ciIdx} style={styles.numberedItem}>
                              <Text style={styles.itemNumber}>{ciIdx + 1}.</Text>
                              <Text style={styles.itemContent}>{ci}</Text>
                            </View>
                          ))}
                        </View>
                      );
                    }
                    return (
                      <View key={sIdx}>
                        <Text style={[styles.fieldLabel, { fontSize: 9, marginTop: 4 }]}>{parsed.label}</Text>
                        <View style={styles.numberedItem}>
                          <Text style={styles.itemNumber}>{sIdx + 1}.</Text>
                          <Text style={styles.itemContent}>{parsed.value}</Text>
                        </View>
                      </View>
                    );
                  }
                  return (
                    <View key={sIdx} style={styles.numberedItem}>
                      <Text style={styles.itemNumber}>{sIdx + 1}.</Text>
                      <Text style={styles.itemContent}>{s}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          );
        }
        return (
          <View key={idx} style={styles.fieldBox}>
            <Text style={styles.fieldLabel}>{label}</Text>
            <View style={styles.numberedItem}>
              <Text style={styles.itemNumber}>1.</Text>
              <Text style={styles.itemContent}>{strVal}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
};

/* Text section with splitBySentence, parseLabel, splitByComma */
const TextSection = ({ title, text }) => {
  if (!text) return null;
  const sentences = splitBySentence(text);
  if (sentences.length === 0) return null;

  let globalNum = 1;
  return (
    <View style={styles.section} wrap={sentences.length > 8 ? undefined : false}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {sentences.map((s, sIdx) => {
        const parsed = parseLabel(s);
        if (parsed.isLabeled) {
          const commaItems = splitByComma(parsed.value);
          if (commaItems.length >= 2) {
            return (
              <View key={sIdx} style={styles.fieldBox}>
                <Text style={styles.fieldLabel}>{parsed.label}</Text>
                {commaItems.map((ci, ciIdx) => (
                  <View key={ciIdx} style={styles.numberedItem}>
                    <Text style={styles.itemNumber}>{globalNum++}.</Text>
                    <Text style={styles.itemContent}>{ci}</Text>
                  </View>
                ))}
              </View>
            );
          }
          return (
            <View key={sIdx} style={styles.fieldBox}>
              <Text style={styles.fieldLabel}>{parsed.label}</Text>
              <View style={styles.numberedItem}>
                <Text style={styles.itemNumber}>{globalNum++}.</Text>
                <Text style={styles.itemContent}>{parsed.value}</Text>
              </View>
            </View>
          );
        }
        return (
          <View key={sIdx} style={styles.fieldBox}>
            <View style={styles.numberedItem}>
              <Text style={styles.itemNumber}>{globalNum++}.</Text>
              <Text style={styles.itemContent}>{s}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
};

/* Array section - handles both strings and {recommendation, date} objects */
const ArraySection = ({ title, items }) => {
  const safeItems = safeArray(items).map(r => {
    if (typeof r === 'string') return r;
    if (r?.recommendation) {
      const recDate = r.date ? ` (${r.date})` : '';
      return `${r.recommendation}${recDate}`;
    }
    return r?.text || JSON.stringify(r);
  });
  if (safeItems.length === 0) return null;

  return (
    <View style={styles.section} wrap={safeItems.length > 8 ? undefined : false}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.fieldBox}>
        {safeItems.map((item, idx) => (
          <View key={idx} style={styles.numberedItem}>
            <Text style={styles.itemNumber}>{idx + 1}.</Text>
            <Text style={styles.itemContent}>{item}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

/* Results section — recursive flatten of dynamic-key object, content-gated, no [object Object] */
const ResultsSection = ({ title, results }) => {
  if (!results || typeof results !== 'object' || Array.isArray(results) || isEmptyDeep(results)) return null;
  const items = flattenResults(results);
  if (items.length === 0) return null;
  return (
    <View style={styles.section} wrap={items.length > 8 ? undefined : false}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.fieldBox}>
        {items.map((item, idx) => (
          <View key={idx} style={styles.numberedItem}>
            <Text style={styles.itemNumber}>{idx + 1}.</Text>
            <Text style={styles.itemContent}>{item.label}: {item.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const VasculitisAssessmentDocumentPDFTemplate = ({ document }) => {
  const records = (() => {
    if (!document) return [];
    if (Array.isArray(document)) return document;
    if (document?.vasculitis_assessment) return document.vasculitis_assessment;
    if (document?.documentData) {
      const docData = document.documentData;
      if (Array.isArray(docData)) return docData;
      if (docData?.vasculitis_assessment) return docData.vasculitis_assessment;
      return [docData];
    }
    if (typeof document === 'object') return [document];
    return [];
  })();

  const hasRecords = records && records.length > 0 && records.some(r => r && Object.keys(r).length > 0);

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Document Header */}
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Vasculitis Assessment Report</Text>
          <Text style={styles.documentSubtitle}>Comprehensive Vasculitis Evaluation</Text>
          <Text style={styles.generatedDate}>Generated: {formatDateShort(new Date().toISOString())}</Text>
        </View>

        {!hasRecords ? (
          <Text style={styles.noRecords}>No vasculitis assessment records available</Text>
        ) : (
          records.map((record, idx) => (
            <View key={idx} style={styles.recordContainer}>
              {/* Record Header */}
              <View style={styles.recordHeader} wrap={false}>
                <Text style={styles.recordTitle}>Record #{idx + 1}</Text>
                <View style={styles.badgeRow}>
                  {record.date && (
                    <Text style={styles.dateBadge}>{formatDate(record.date)}</Text>
                  )}
                  {record.status && (
                    <Text style={styles.statusBadge}>{record.status}</Text>
                  )}
                </View>
              </View>

              {/* Type & Scores */}
              <FieldSection title="Type & Scores" fields={[
                ['Type', record.type],
                ['BVAS Score', record.bvasScore],
                ['VDI Score', record.vdiScore],
              ]} />

              {/* Organ Systems */}
              <ArraySection title="Organ Systems" items={record.organSystems} />

              {/* Diagnostic Studies */}
              <FieldSection title="Diagnostic Studies" fields={[
                ['Biopsy Results', record.biopsyResults],
                ['Angiographic Findings', record.angiographicFindings],
              ]} />

              {/* Findings */}
              <TextSection title="Findings" text={record.findings} />

              {/* Assessment */}
              <TextSection title="Assessment" text={record.assessment} />

              {/* Plan */}
              <TextSection title="Plan" text={record.plan} />

              {/* Recommendations */}
              <ArraySection title="Recommendations" items={record.recommendations} />

              {/* Results (dynamic-key object) */}
              <ResultsSection title="Results" results={record.results} />

              {/* Notes */}
              <TextSection title="Notes" text={record.notes} />

              {/* Provider Information */}
              {(record.provider || record.facility) && (
                <View style={styles.providerSection} wrap={false}>
                  <Text style={styles.sectionTitle}>Provider Information</Text>
                  <View style={styles.providerGrid}>
                    {record.provider && (
                      <View style={styles.providerItem}>
                        <Text style={styles.providerLabel}>Provider</Text>
                        <Text style={styles.providerValue}>{record.provider}</Text>
                      </View>
                    )}
                    {record.facility && (
                      <View style={styles.providerItem}>
                        <Text style={styles.providerLabel}>Facility</Text>
                        <Text style={styles.providerValue}>{record.facility}</Text>
                      </View>
                    )}
                  </View>
                </View>
              )}
            </View>
          ))
        )}

        {/* Footer */}
        <Text style={styles.footer}>Confidential Medical Document</Text>
      </Page>
    </Document>
  );
};

export default VasculitisAssessmentDocumentPDFTemplate;
