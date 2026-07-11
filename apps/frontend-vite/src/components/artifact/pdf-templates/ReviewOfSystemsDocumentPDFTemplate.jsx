/* ReviewOfSystemsDocumentPDFTemplate.jsx - December 2025 REBUILD */
/* Helvetica font | Black & White | 14pt minimum */

import React from 'react';
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';

// Unicode sanitization for Helvetica
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

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 14,
    backgroundColor: '#ffffff',
    color: '#000000',
  },
  documentTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginBottom: 20,
    textAlign: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
    paddingBottom: 10,
  },
  recordContainer: {
    marginBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#666666',
    paddingBottom: 16,
  },
  recordTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginBottom: 4,
  },
  recordMeta: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 12,
  },
  sectionContainer: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    paddingBottom: 4,
  },
  fieldBlock: {
    marginBottom: 8,
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
    color: '#000000',
    marginBottom: 4,
    paddingLeft: 12,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  scoreLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    width: 100,
  },
  scoreValue: {
    fontSize: 14,
    color: '#000000',
  },
  severityBadge: {
    fontSize: 12,
    color: '#666666',
    fontStyle: 'italic',
  },
  emptyState: {
    fontSize: 14,
    color: '#666666',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 40,
  },
});

const ReviewOfSystemsDocumentPDFTemplate = ({ document, data }) => {
  const templateData = document || data;

  // Unwrap nested documents
  const unwrappedData = (() => {
    if (!templateData) return [];
    if (Array.isArray(templateData)) {
      return templateData.flatMap(item => {
        if (item?.document) return Array.isArray(item.document) ? item.document : [item.document];
        if (item?.data) return Array.isArray(item.data) ? item.data : [item.data];
        return [item];
      });
    }
    return [templateData];
  })();

  // Format date helper
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

  // Split by comma preserving parentheses
  const splitByComma = (text) => {
    if (!text || typeof text !== 'string') return [];
    const result = [];
    let current = '';
    let depth = 0;
    for (const char of text) {
      if (char === '(') depth++;
      else if (char === ')') depth--;
      else if (char === ',' && depth === 0) {
        const trimmed = current.trim();
        if (trimmed) result.push(trimmed);
        current = '';
        continue;
      }
      current += char;
    }
    const trimmed = current.trim();
    if (trimmed) result.push(trimmed);
    return result;
  };

  // Split a narrative string into sentences
  const splitBySentence = (text) => {
    if (!text || typeof text !== 'string') return [];
    return text.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
  };

  // Recursive object helpers
  const humanizeKey = (key) => {
    if (key === null || key === undefined || key === '') return '';
    const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
    return s.charAt(0).toUpperCase() + s.slice(1);
  };
  const isScalar = (v) => v === null || typeof v !== 'object';
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

  // Recursive object → flat rows for PDF
  const renderObjectRows = (label, value, depth, keyBase) => {
    if (isEmptyDeep(value)) return [];
    if (isScalar(value)) {
      return [(
        <View key={keyBase} style={[styles.fieldBlock, { paddingLeft: depth * 12 }]}>
          <Text style={styles.fieldLabel}>{safeString(label)}</Text>
          <Text style={styles.fieldValue}>{safeString(fmtScalar(value))}</Text>
        </View>
      )];
    }
    const rows = [];
    if (label) rows.push(
      <Text key={`${keyBase}-h`} style={[styles.fieldLabel, { paddingLeft: depth * 12 }]}>{safeString(label)}</Text>
    );
    Object.entries(value).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => {
      rows.push(...renderObjectRows(humanizeKey(k), v, depth + (label ? 1 : 0), `${keyBase}-${k}`));
    });
    return rows;
  };

  // Parse notes with embedded labels
  const parseNotesWithLabels = (text) => {
    if (!text || typeof text !== 'string') return [];
    const pattern = /([A-Za-z\s]+):\s*([^;]+)/g;
    const results = [];
    let match;
    while ((match = pattern.exec(text)) !== null) {
      results.push({ label: match[1].trim(), value: match[2].trim() });
    }
    if (results.length === 0 && text.trim()) {
      return [{ label: 'Notes', value: text.trim() }];
    }
    return results;
  };

  // PHQ-9 severity
  const getPhq9Severity = (score) => {
    const s = parseInt(score, 10);
    if (isNaN(s)) return '';
    if (s <= 4) return 'Minimal';
    if (s <= 9) return 'Mild';
    if (s <= 14) return 'Moderate';
    if (s <= 19) return 'Moderately Severe';
    return 'Severe';
  };

  // GAD-7 severity
  const getGad7Severity = (score) => {
    const s = parseInt(score, 10);
    if (isNaN(s)) return '';
    if (s <= 4) return 'Minimal';
    if (s <= 9) return 'Mild';
    if (s <= 14) return 'Moderate';
    return 'Severe';
  };

  // Body system fields configuration
  const bodySystemFields = [
    { key: 'constitutional', label: 'Constitutional' },
    { key: 'heent', label: 'HEENT' },
    { key: 'eyes', label: 'Eyes' },
    { key: 'ent', label: 'ENT' },
    { key: 'cardiovascular', label: 'Cardiovascular' },
    { key: 'respiratory', label: 'Respiratory' },
    { key: 'gastrointestinal', label: 'Gastrointestinal' },
    { key: 'musculoskeletal', label: 'Musculoskeletal' },
    { key: 'neurological', label: 'Neurological' },
    { key: 'endocrine', label: 'Endocrine' },
    { key: 'hematologic', label: 'Hematologic' },
    { key: 'skin', label: 'Skin' },
    { key: 'sleepSymptoms', label: 'Sleep Symptoms' },
  ];

  const renderRecord = (record, idx) => {
    // Determine which body systems have data
    const activeBodySystems = bodySystemFields.filter(f => {
      const val = record[f.key];
      return val && (typeof val === 'string' ? val.trim() : true);
    });

    // Check for genitourinary object
    const hasGenitourinary = record.genitourinary?.symptoms;

    // Check for psychiatric object
    const hasPsychiatric = record.psychiatric?.symptoms ||
      record.psychiatric?.phq9Score !== undefined ||
      record.psychiatric?.gad7Score !== undefined;

    // Check for notes
    const hasNotes = record.notes?.trim();

    return (
      <View key={record._id || idx} style={styles.recordContainer}>
        {/* Record Header - wrap together (small) */}
        <View wrap={false}>
          <Text style={styles.recordTitle}>
            {safeString(`Review of Systems ${idx + 1}`)}
          </Text>
          {record.createdAt && (
            <Text style={styles.recordMeta}>{safeString(formatDate(record.createdAt))}</Text>
          )}
        </View>

        {/* Record Info Section - small section, wrap together */}
        {record.createdAt && (
          <View style={styles.sectionContainer} wrap={false}>
            <Text style={styles.sectionTitle}>Record Info</Text>
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Date</Text>
              <Text style={styles.fieldValue}>{safeString(formatDate(record.createdAt))}</Text>
            </View>
          </View>
        )}

        {/* Body Systems Section - LARGE (10+ items), use Pattern 2: title + first item together */}
        {activeBodySystems.length > 0 && (
          <View style={styles.sectionContainer}>
            {/* Title + first body system wrapped together */}
            <View wrap={false}>
              <Text style={styles.sectionTitle}>Body Systems</Text>
              {activeBodySystems.slice(0, 1).map(({ key, label }) => {
                const items = splitBySentence(record[key]);
                return (
                  <View key={key} style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>{label}</Text>
                    {items.map((item, itemIdx) => (
                      <Text key={itemIdx} style={styles.listItem}>
                        {itemIdx + 1}. {safeString(item)}
                      </Text>
                    ))}
                  </View>
                );
              })}
            </View>
            {/* Rest of body systems flow naturally */}
            {activeBodySystems.slice(1).map(({ key, label }) => {
              const items = splitBySentence(record[key]);
              return (
                <View key={key} style={styles.fieldBlock}>
                  <Text style={styles.fieldLabel}>{label}</Text>
                  {items.map((item, itemIdx) => (
                    <Text key={itemIdx} style={styles.listItem}>
                      {itemIdx + 1}. {safeString(item)}
                    </Text>
                  ))}
                </View>
              );
            })}
          </View>
        )}

        {/* Genitourinary Section - Pattern 2: title + first symptom together */}
        {hasGenitourinary && (() => {
          const guSymptoms = splitBySentence(record.genitourinary.symptoms);
          return (
            <View style={styles.sectionContainer}>
              <View wrap={false}>
                <Text style={styles.sectionTitle}>Genitourinary</Text>
                <View style={styles.fieldBlock}>
                  <Text style={styles.fieldLabel}>Symptoms</Text>
                  {guSymptoms.slice(0, 1).map((item, itemIdx) => (
                    <Text key={itemIdx} style={styles.listItem}>
                      {itemIdx + 1}. {safeString(item)}
                    </Text>
                  ))}
                </View>
              </View>
              {/* Rest flow naturally */}
              {guSymptoms.length > 1 && (
                <View style={styles.fieldBlock}>
                  {guSymptoms.slice(1).map((item, itemIdx) => (
                    <Text key={itemIdx} style={styles.listItem}>
                      {itemIdx + 2}. {safeString(item)}
                    </Text>
                  ))}
                </View>
              )}
            </View>
          );
        })()}

        {/* Psychiatric Section - Pattern 2 for symptoms, wrap scores together */}
        {hasPsychiatric && (() => {
          const psychSymptoms = record.psychiatric?.symptoms ? splitBySentence(record.psychiatric.symptoms) : [];
          return (
            <View style={styles.sectionContainer}>
              {/* Title + first symptom (if any) wrapped together */}
              <View wrap={false}>
                <Text style={styles.sectionTitle}>Psychiatric</Text>
                {psychSymptoms.length > 0 && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Symptoms</Text>
                    {psychSymptoms.slice(0, 1).map((item, itemIdx) => (
                      <Text key={itemIdx} style={styles.listItem}>
                        {itemIdx + 1}. {safeString(item)}
                      </Text>
                    ))}
                  </View>
                )}
              </View>

              {/* Rest of symptoms flow naturally */}
              {psychSymptoms.length > 1 && (
                <View style={styles.fieldBlock}>
                  {psychSymptoms.slice(1).map((item, itemIdx) => (
                    <Text key={itemIdx} style={styles.listItem}>
                      {itemIdx + 2}. {safeString(item)}
                    </Text>
                  ))}
                </View>
              )}

              {/* Scores - small, wrap together */}
              {(record.psychiatric?.phq9Score !== undefined || record.psychiatric?.gad7Score !== undefined) && (
                <View wrap={false}>
                  {record.psychiatric?.phq9Score !== undefined && (
                    <View style={styles.scoreRow}>
                      <Text style={styles.scoreLabel}>PHQ-9 Score:</Text>
                      <Text style={styles.scoreValue}>{safeString(record.psychiatric.phq9Score)}/27</Text>
                      <Text style={styles.severityBadge}>({getPhq9Severity(record.psychiatric.phq9Score)})</Text>
                    </View>
                  )}

                  {record.psychiatric?.gad7Score !== undefined && (
                    <View style={styles.scoreRow}>
                      <Text style={styles.scoreLabel}>GAD-7 Score:</Text>
                      <Text style={styles.scoreValue}>{safeString(record.psychiatric.gad7Score)}/21</Text>
                      <Text style={styles.severityBadge}>({getGad7Severity(record.psychiatric.gad7Score)})</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          );
        })()}

        {/* Findings / Assessment / Plan — narrative, per-sentence, wrap-gated per field (Rule #74) */}
        {[
          { key: 'findings', label: 'Findings' },
          { key: 'assessment', label: 'Assessment' },
          { key: 'plan', label: 'Plan' },
        ].map(({ key, label }) => {
          const val = record[key];
          if (!val || (typeof val === 'string' && !val.trim())) return null;
          const sentences = splitBySentence(String(val));
          if (sentences.length === 0) return null;
          return (
            <View key={key} style={styles.sectionContainer} wrap={sentences.length > 8 ? undefined : false}>
              <Text style={styles.sectionTitle}>{safeString(label)}</Text>
              {sentences.map((s, sIdx) => (
                <Text key={sIdx} style={styles.listItem}>{sIdx + 1}. {safeString(s)}</Text>
              ))}
            </View>
          );
        })}

        {/* Results Section — recursive OBJECT, wrap-gated by row count (Rule #74) */}
        {record.results && !isEmptyDeep(record.results) && (() => {
          const entries = Object.entries(record.results).filter(([, v]) => !isEmptyDeep(v));
          if (entries.length === 0) return null;
          const rows = [];
          entries.forEach(([k, v]) => rows.push(...renderObjectRows(humanizeKey(k), v, 0, `results-${k}`)));
          return (
            <View style={styles.sectionContainer} wrap={rows.length > 8 ? undefined : false}>
              <Text style={styles.sectionTitle}>Results</Text>
              {rows}
            </View>
          );
        })()}

        {/* Recommendations Section — ARRAY, date-grouped, wrap-gated (Rule #74) */}
        {record.recommendations && !isEmptyDeep(record.recommendations) && (() => {
          const recs = Array.isArray(record.recommendations) ? record.recommendations : [];
          const groups = [];
          recs.forEach((r) => {
            const rec = (typeof r === 'string' ? r : r?.recommendation || '').trim();
            const date = (typeof r === 'string' ? '' : r?.date || '').trim();
            if (!rec) return;
            const last = groups[groups.length - 1];
            if (last && last.date === date) last.items.push(rec);
            else groups.push({ date, items: [rec] });
          });
          if (groups.length === 0) return null;
          const totalItems = groups.reduce((acc, g) => acc + g.items.length + (g.date ? 1 : 0), 0);
          return (
            <View style={styles.sectionContainer} wrap={totalItems > 8 ? undefined : false}>
              <Text style={styles.sectionTitle}>Recommendations</Text>
              {groups.map((group, gIdx) => (
                <View key={gIdx} style={styles.fieldBlock}>
                  {group.date && <Text style={styles.fieldLabel}>{safeString(group.date)}</Text>}
                  {group.items.map((rec, rIdx) => (
                    <Text key={rIdx} style={styles.listItem}>{rIdx + 1}. {safeString(rec)}</Text>
                  ))}
                </View>
              ))}
            </View>
          );
        })()}

        {/* Additional Notes Section - Pattern 2: title + first note together */}
        {hasNotes && (() => {
          const parsedNotes = parseNotesWithLabels(record.notes);
          return (
            <View style={styles.sectionContainer}>
              <View wrap={false}>
                <Text style={styles.sectionTitle}>Additional Notes</Text>
                {parsedNotes.slice(0, 1).map((item, itemIdx) => (
                  <View key={itemIdx} style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>{item.label}</Text>
                    <Text style={styles.fieldValue}>{safeString(item.value)}</Text>
                  </View>
                ))}
              </View>
              {/* Rest flow naturally */}
              {parsedNotes.slice(1).map((item, itemIdx) => (
                <View key={itemIdx} style={styles.fieldBlock}>
                  <Text style={styles.fieldLabel}>{item.label}</Text>
                  <Text style={styles.fieldValue}>{safeString(item.value)}</Text>
                </View>
              ))}
            </View>
          );
        })()}
      </View>
    );
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.documentTitle}>Review of Systems</Text>

        {unwrappedData.length > 0 ? (
          unwrappedData.map((record, idx) => renderRecord(record, idx))
        ) : (
          <Text style={styles.emptyState}>No review of systems records available.</Text>
        )}
      </Page>
    </Document>
  );
};

export default ReviewOfSystemsDocumentPDFTemplate;
