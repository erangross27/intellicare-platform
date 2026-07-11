/**
 * SurgicalApproachDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — surgical approach
 * Collection: surgical_approach
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#3f3f46', borderBottomStyle: 'solid' },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#1f2937', textAlign: 'center', marginBottom: 4 },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#3f3f46', borderBottomStyle: 'solid' },
  recordDateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  recordDate: { fontSize: 11, color: '#6b7280', fontFamily: 'Helvetica' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#1f2937' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#3f3f46', marginBottom: 8 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#333333', marginBottom: 2 },
  fieldValue: { fontSize: 11, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 11, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#d1d5db', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 12, color: '#6b7280', textAlign: 'center', marginTop: 40 },
});

/* ======= UTILS ======= */
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr.$date || dateStr);
    if (isNaN(date.getTime())) return String(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return String(dateStr); }
};

const safeString = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'object' && val.$date) return formatDate(val.$date);
  return String(val);
};

const hasVal = (v) => {
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'boolean') return true;
  if (typeof v === 'number') return true;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v).length > 0;
  return true;
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.(?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};

const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
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

/* ======= RENDER FIELD ======= */
const renderField = (label, value) => {
  if (!hasVal(value)) return null;
  const strVal = safeString(value);
  const sentences = splitBySentence(strVal);
  if (sentences.length > 1) {
    let n = 1;
    return (
      <View style={styles.fieldBox} wrap={false}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {sentences.map((s, sIdx) => {
          const parsed = parseLabel(s);
          if (parsed.isLabeled) {
            const items = splitByComma(parsed.value);
            if (items.length >= 2) {
              return (
                <View key={sIdx}>
                  <Text style={styles.nestedSubtitle}>{safeString(parsed.label)}:</Text>
                  {items.map((item, i) => <Text key={i} style={styles.listItem}>{n++}. {safeString(item)}</Text>)}
                </View>
              );
            }
            return (
              <View key={sIdx}>
                <Text style={styles.nestedSubtitle}>{safeString(parsed.label)}:</Text>
                <Text style={styles.listItem}>{n++}. {safeString(parsed.value)}</Text>
              </View>
            );
          }
          return <Text key={sIdx} style={styles.listItem}>{n++}. {safeString(s)}</Text>;
        })}
      </View>
    );
  }
  return (
    <View style={styles.fieldBox} wrap={false}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{strVal}</Text>
    </View>
  );
};

/* ======= OBJECT HELPERS ======= */
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

/* count scalar leaves (for wrap gating) */
const countLeaves = (v) => {
  if (isEmptyDeep(v)) return 0;
  if (isScalar(v)) return 1;
  if (Array.isArray(v)) return v.reduce((a, x) => a + countLeaves(x), 0);
  return Object.values(v).reduce((a, x) => a + countLeaves(x), 0);
};

/* recursive grayscale object renderer (rows only — no section title) */
const renderObjectRows = (value, depth, keyPrefix) => {
  if (isEmptyDeep(value)) return null;
  if (isScalar(value)) return null;
  const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
  return entries.map(([k, v], i) => {
    const rowKey = `${keyPrefix}-${k}-${i}`;
    if (isScalar(v)) {
      return (
        <View key={rowKey} style={{ marginBottom: 2, paddingLeft: depth * 8 }}>
          <Text style={styles.listItem}>{humanizeKey(k)}: {safeString(v)}</Text>
        </View>
      );
    }
    return (
      <View key={rowKey} style={{ marginBottom: 2, paddingLeft: depth * 8 }}>
        <Text style={styles.nestedSubtitle}>{humanizeKey(k)}</Text>
        {renderObjectRows(v, depth + 1, rowKey)}
      </View>
    );
  });
};

/* OBJECT field block: section title + object rows; wrap gated on leaf count */
const renderObjectSection = (title, value) => {
  if (isEmptyDeep(value) || isScalar(value)) return null;
  const leaves = countLeaves(value);
  return (
    <View style={styles.section} wrap={leaves > 8 ? undefined : false}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {renderObjectRows(value, 0, title)}
    </View>
  );
};

/* ======= COMPONENT ======= */
const SurgicalApproachDocumentPDFTemplate = ({ document: docProp, data }) => {
  const templateData = docProp || data;

  const records = (() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.surgical_approach) return Array.isArray(r.surgical_approach) ? r.surgical_approach : [r.surgical_approach];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.surgical_approach) return Array.isArray(dd.surgical_approach) ? dd.surgical_approach : [dd.surgical_approach]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  })();

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}><Text style={styles.documentTitle}>Surgical Approach</Text></View>
          <Text style={styles.noDataText}>No surgical approach data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Surgical Approach</Text>
        </View>

        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            {idx > 0 && <View style={styles.separator} />}

            <View style={styles.recordHeader}>
              {hasVal(record.date) && (
                <View style={styles.recordDateRow}>
                  <Text style={styles.recordDate}>{formatDate(record.date)}</Text>
                </View>
              )}
              <Text style={styles.recordTitle}>Surgical Approach {idx + 1}</Text>
            </View>

            {/* Procedure Information */}
            {(hasVal(record.technique) || hasVal(record.positioning) || hasVal(record.prepAndDraping) || hasVal(record.type) || hasVal(record.status)) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Procedure Information</Text>
                {renderField('Technique', record.technique)}
                {renderField('Positioning', record.positioning)}
                {renderField('Prep & Draping', record.prepAndDraping)}
                {renderField('Type', record.type)}
                {renderField('Status', record.status)}
              </View>
            )}

            {/* Provider & Date */}
            {(hasVal(record.provider) || hasVal(record.facility)) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Provider & Date</Text>
                {renderField('Provider', record.provider)}
                {renderField('Facility', record.facility)}
              </View>
            )}

            {/* Pneumoperitoneum (OBJECT) */}
            {renderObjectSection('Pneumoperitoneum', record.pneumoperitoneum)}

            {/* Port Placement (ARRAY of objects) */}
            {Array.isArray(record.portPlacement) && record.portPlacement.filter(p => !isEmptyDeep(p)).length > 0 && (
              <View style={styles.section} wrap={record.portPlacement.length > 8 ? undefined : false}>
                <Text style={styles.sectionTitle}>Port Placement</Text>
                {record.portPlacement.map((port, portIdx) => {
                  if (isEmptyDeep(port)) return null;
                  if (isScalar(port)) {
                    return (
                      <View key={portIdx} style={styles.fieldBox} wrap={false}>
                        <Text style={styles.listItem}>{portIdx + 1}. {safeString(port)}</Text>
                      </View>
                    );
                  }
                  return (
                    <View key={portIdx} style={styles.fieldBox} wrap={false}>
                      <Text style={styles.nestedSubtitle}>Port {portIdx + 1}</Text>
                      {renderObjectRows(port, 0, `port-${portIdx}`)}
                    </View>
                  );
                })}
              </View>
            )}

            {/* Incisions */}
            {Array.isArray(record.incisions) && record.incisions.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Incisions</Text>
                {record.incisions.map((inc, incIdx) => (
                  <View key={incIdx} style={styles.fieldBox} wrap={false}>
                    <Text style={styles.listItem}>{incIdx + 1}. {safeString(inc.type)}{inc.location ? ` - ${safeString(inc.location)}` : ''}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Findings & Assessment */}
            {(hasVal(record.findings) || hasVal(record.assessment)) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Findings & Assessment</Text>
                {renderField('Findings', record.findings)}
                {renderField('Assessment', record.assessment)}
              </View>
            )}

            {/* Plan & Recommendations */}
            {(hasVal(record.plan) || (Array.isArray(record.recommendations) && record.recommendations.length > 0)) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Plan & Recommendations</Text>
                {renderField('Plan', record.plan)}
                {Array.isArray(record.recommendations) && record.recommendations.length > 0 && (
                  <View style={styles.fieldBox}>
                    <Text style={styles.fieldLabel}>Recommendations</Text>
                    {record.recommendations.map((rec, rIdx) => (
                      <Text key={rIdx} style={styles.listItem}>{rIdx + 1}. {safeString(rec.recommendation || rec)}</Text>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Results (OBJECT) */}
            {renderObjectSection('Results', record.results)}

            {/* Notes */}
            {hasVal(record.notes) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Notes</Text>
                {renderField('Notes', record.notes)}
              </View>
            )}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default SurgicalApproachDocumentPDFTemplate;
