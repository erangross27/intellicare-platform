/**
 * PsychiatricReviewDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — parseLabel + comma-split — no boxes (fieldBox has no border)
 * Collection: psychiatric_review
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 24, borderBottomWidth: 3, borderBottomColor: '#000000', paddingBottom: 14 },
  title: { fontSize: 22, fontFamily: 'Helvetica-Bold', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 2 },
  recordContainer: { marginBottom: 28, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#cccccc' },
  recordHeader: { marginBottom: 16, backgroundColor: '#f5f5f5', padding: 12, borderWidth: 2, borderColor: '#000000', borderLeftWidth: 5, borderLeftColor: '#000000' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold' },
  recordDate: { fontSize: 10, color: '#666666', marginTop: 4 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#333333', marginBottom: 2 },
  fieldValue: { fontSize: 11, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 11, lineHeight: 1.5, marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  medCard: { backgroundColor: '#f8f9fa', padding: 8, marginBottom: 4 },
  medName: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  medField: { fontSize: 10, marginBottom: 2, paddingLeft: 6 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#666666' },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, fontSize: 10, color: '#666666', borderTopWidth: 1, borderTopColor: '#000000', paddingTop: 10, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 10, color: '#666666' },
});

/* ═══ UTILS ═══ */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'string' ? val : String(val);
  str = str.replace(/\u00b5m/g, 'um').replace(/\u03bcm/g, 'um').replace(/\u00b0/g, ' deg')
    .replace(/\u00b1/g, '+/-').replace(/\u2265/g, '>=').replace(/\u2264/g, '<=')
    .replace(/\u2192/g, '->').replace(/\u201c/g, '"').replace(/\u201d/g, '"')
    .replace(/\u2018/g, "'").replace(/\u2019/g, "'").replace(/\u2014/g, '-').replace(/\u2013/g, '-');
  return str;
};

const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
const safeArray = (v) => Array.isArray(v) ? v.filter(Boolean) : [];

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  const result = []; let current = ''; let inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"' || ch === '\u201C' || ch === '\u201D') {
      const wasInQuote = inQuote; inQuote = !inQuote; current += ch;
      if (wasInQuote && !inQuote && current.length >= 2 && current[current.length - 2] === '.' && i + 1 < text.length && /\s/.test(text[i + 1])) {
        const t2 = current.trim(); if (t2 && !/^[;.,!?]+$/.test(t2)) result.push(t2); current = '';
      }
      continue;
    }
    if (ch === '.' && !inQuote && i + 1 < text.length && /\s/.test(text[i + 1])) {
      const before = current.trim().split(/\s+/).pop() || '';
      if (/^(Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc)$/i.test(before)) { current += ch; continue; }
      const t = current.trim(); if (t && !/^[;.,!?]+$/.test(t)) result.push(t); current = '';
    } else { current += ch; }
  }
  const t = current.trim(); if (t && !/^[;.,!?]+$/.test(t)) result.push(t);
  return result;
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
    if (ch === '(' || ch === '"' || ch === "'") { depth++; current += ch; }
    else if (ch === ')' || (depth > 0 && (ch === '"' || ch === "'"))) { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) { const t = current.trim(); if (t) result.push(t); current = ''; }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try { return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateStr); }
};

const METABOLIC_LABELS = {
  weight: 'Weight',
  glucose: 'Glucose',
  lipids: 'Lipids',
  prolactin: 'Prolactin',
  thyroid: 'Thyroid',
};

const KEY_OVERRIDES = {
  ekg: 'EKG', ecg: 'ECG', bmi: 'BMI', tsh: 'TSH', ldl: 'LDL', hdl: 'HDL', qtc: 'QTc',
  id: 'ID', url: 'URL',
};

/* humanizeKey: camelCase / snake_case object key -> Title Case label */
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

/* objectLines: flatten a dynamic-key object into [{depth,label,value}] (value=null for nested header). No "[object Object]". */
const objectLines = (value, depth = 0, label = '') => {
  const out = [];
  if (isObjEmptyDeep(value)) return out;
  if (value === null || typeof value !== 'object') {
    out.push({ depth, label, value: fmtVal(value) });
    return out;
  }
  if (label) out.push({ depth, label, value: null });
  Object.entries(value).filter(([, v]) => !isObjEmptyDeep(v)).forEach(([k, v]) => {
    out.push(...objectLines(v, depth + (label ? 1 : 0), humanizeKey(k)));
  });
  return out;
};

const BLOOD_LEVEL_FIELDS = [
  { key: 'level', label: 'Level' },
  { key: 'date', label: 'Date' },
  { key: 'therapeutic', label: 'Therapeutic' },
];

/* renderFieldRow: label + value inside fieldBox (for non-string values) */
const renderFieldRow = (label, value) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{safeString(fmtVal(value))}</Text>
    </View>
  );
};

/* renderSentenceField: parseLabel + comma-split with sequential counter */
const renderSentenceField = (label, text, counterRef) => {
  if (!hasVal(text)) return null;
  if (typeof text !== 'string') {
    return renderFieldRow(label, text);
  }
  const sentences = splitBySentence(fmtVal(text));
  if (sentences.length === 0) return null;

  const rows = [];
  sentences.forEach(s => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const commaItems = splitByComma(parsed.value);
      if (commaItems.length >= 2) {
        rows.push({ type: 'subtitle', text: safeString(parsed.label) });
        commaItems.forEach(ci => { rows.push({ type: 'item', text: safeString(ci), num: counterRef.n++ }); });
      } else {
        rows.push({ type: 'item', text: safeString(s), num: counterRef.n++ });
      }
    } else {
      rows.push({ type: 'item', text: safeString(s), num: counterRef.n++ });
    }
  });

  const wrapProp = rows.length > 8 ? undefined : false;

  return (
    <View style={styles.fieldBox} wrap={wrapProp}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {rows.map((row, i) => {
        if (row.type === 'subtitle') {
          return <Text key={i} style={styles.nestedSubtitle}>{row.text}</Text>;
        }
        return <Text key={i} style={styles.listItem}>{row.num}. {row.text}</Text>;
      })}
    </View>
  );
};

/* ═══ COMPONENT ═══ */
const PsychiatricReviewDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.psychiatric_review) return Array.isArray(r.psychiatric_review) ? r.psychiatric_review : [r.psychiatric_review];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.psychiatric_review) return Array.isArray(dd.psychiatric_review) ? dd.psychiatric_review : [dd.psychiatric_review]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}><Text style={styles.title}>Psychiatric Review</Text></View>
          <Text style={styles.emptyState}>No records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Psychiatric Review</Text></View>

        {records.map((record, idx) => {
          const ctr = { n: 1 };
          const sideEffects = safeArray(record.medicationSideEffects);
          const bloodLevels = safeArray(record.bloodLevels);
          const metaEntries = record.metabolicMonitoring ? Object.entries(record.metabolicMonitoring).filter(([, v]) => hasVal(v)) : [];
          const recommendations = safeArray(record.recommendations);
          const resultsLines = (record.results && typeof record.results === 'object' && !isObjEmptyDeep(record.results)) ? objectLines(record.results, 0, '') : [];

          return (
            <View key={idx} style={styles.recordContainer}>
              {/* Record Header */}
              <View style={styles.recordHeader} wrap={false}>
                <Text style={styles.recordTitle}>{`Psychiatric Review ${idx + 1}`}</Text>
                {record.date && <Text style={styles.recordDate}>{formatDate(record.date)}</Text>}
              </View>

              {/* Section 1: Visit Information */}
              {(hasVal(record.date) || hasVal(record.type) || hasVal(record.provider) || hasVal(record.facility) || hasVal(record.status)) && (
                <View style={styles.section}>
                  <View style={styles.fieldBox} wrap={false}>
                    <Text style={styles.sectionTitle}>Visit Information</Text>
                    {hasVal(record.date) && (
                      <View style={{ marginBottom: 4 }}>
                        <Text style={styles.fieldLabel}>Date</Text>
                        <Text style={styles.fieldValue}>{formatDate(record.date)}</Text>
                      </View>
                    )}
                    {['type', 'provider', 'facility', 'status'].map(f => hasVal(record[f]) ? (
                      <View key={f} style={{ marginBottom: 4 }}>
                        <Text style={styles.fieldLabel}>{f === 'type' ? 'Type' : f === 'provider' ? 'Provider' : f === 'facility' ? 'Facility' : 'Status'}</Text>
                        <Text style={styles.fieldValue}>{safeString(record[f])}</Text>
                      </View>
                    ) : null)}
                  </View>
                </View>
              )}

              {/* Section 2: Medication Review */}
              {(hasVal(record.lastPsychiatristVisit) || hasVal(record.medicationCompliance) || sideEffects.length > 0 || hasVal(record.therapeuticResponse)) && (
                <View style={styles.section}>
                  <View style={styles.fieldBox} wrap={false}>
                    <Text style={styles.sectionTitle}>Medication Review</Text>
                    {hasVal(record.lastPsychiatristVisit) && (
                      <View style={{ marginBottom: 4 }}>
                        <Text style={styles.fieldLabel}>Last Psychiatrist Visit</Text>
                        <Text style={styles.fieldValue}>{safeString(record.lastPsychiatristVisit)}</Text>
                      </View>
                    )}
                  </View>
                  {hasVal(record.medicationCompliance) && renderSentenceField('Medication Compliance', record.medicationCompliance, ctr)}
                  {sideEffects.length > 0 && (
                    <View style={styles.fieldBox} wrap={sideEffects.length > 8 ? undefined : false}>
                      <Text style={styles.fieldLabel}>Medication Side Effects</Text>
                      {sideEffects.map((se, i) => (
                        <Text key={i} style={styles.listItem}>{ctr.n++}. {safeString(typeof se === 'string' ? se.replace(/^\d+[.)]\s*/, '') : se)}</Text>
                      ))}
                    </View>
                  )}
                  {hasVal(record.therapeuticResponse) && renderSentenceField('Therapeutic Response', record.therapeuticResponse, ctr)}
                </View>
              )}

              {/* Section 3: Lab Monitoring */}
              {(bloodLevels.length > 0 || metaEntries.length > 0 || hasVal(record.ekg) || hasVal(record.geneticTesting)) && (
                <View style={styles.section}>
                  <View style={styles.fieldBox} wrap={false}>
                    <Text style={styles.sectionTitle}>Lab Monitoring</Text>
                  </View>
                  {bloodLevels.length > 0 && (
                    <View style={styles.fieldBox} wrap={bloodLevels.length > 4 ? undefined : false}>
                      <Text style={styles.fieldLabel}>Blood Levels</Text>
                      {bloodLevels.map((bl, bi) => (
                        <View key={bi} style={styles.medCard}>
                          <Text style={styles.medName}>{safeString(bl.medication || `Blood Level ${bi + 1}`)}</Text>
                          {BLOOD_LEVEL_FIELDS.map(field => {
                            const val = bl[field.key];
                            if (!hasVal(val)) return null;
                            return <Text key={field.key} style={styles.medField}>{field.label}: {safeString(fmtVal(val))}</Text>;
                          })}
                        </View>
                      ))}
                    </View>
                  )}
                  {metaEntries.length > 0 && (
                    <View style={styles.fieldBox} wrap={false}>
                      <Text style={styles.fieldLabel}>Metabolic Monitoring</Text>
                      {metaEntries.map(([key, val]) => (
                        <View key={key} style={{ marginBottom: 2 }}>
                          <Text style={styles.medField}>{METABOLIC_LABELS[key] || key}: {safeString(fmtVal(val))}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  {hasVal(record.ekg) && renderSentenceField('EKG', record.ekg, ctr)}
                  {hasVal(record.geneticTesting) && renderSentenceField('Genetic Testing', record.geneticTesting, ctr)}
                </View>
              )}

              {/* Section 4: Clinical Assessment */}
              {(hasVal(record.findings) || hasVal(record.assessment)) && (
                <View style={styles.section}>
                  <View style={styles.fieldBox} wrap={false}>
                    <Text style={styles.sectionTitle}>Clinical Assessment</Text>
                  </View>
                  {hasVal(record.findings) && renderSentenceField('Findings', record.findings, ctr)}
                  {hasVal(record.assessment) && renderSentenceField('Assessment', record.assessment, ctr)}
                </View>
              )}

              {/* Section 5: Management */}
              {(hasVal(record.plan) || hasVal(record.notes) || recommendations.length > 0) && (
                <View style={styles.section}>
                  <View style={styles.fieldBox} wrap={false}>
                    <Text style={styles.sectionTitle}>Management</Text>
                  </View>
                  {hasVal(record.plan) && renderSentenceField('Plan', record.plan, ctr)}
                  {hasVal(record.notes) && renderSentenceField('Notes', record.notes, ctr)}
                  {recommendations.length > 0 && (
                    <View style={styles.fieldBox} wrap={recommendations.length > 4 ? undefined : false}>
                      <Text style={styles.fieldLabel}>Recommendations</Text>
                      {recommendations.map((rec, ri) => (
                        <View key={ri} style={styles.medCard}>
                          <Text style={styles.medName}>{safeString(rec.recommendation || `Recommendation ${ri + 1}`)}</Text>
                          {hasVal(rec.date) && <Text style={styles.medField}>Date: {safeString(rec.date)}</Text>}
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {/* Section 6: Results (dynamic-key object) */}
              {resultsLines.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.fieldBox} wrap={resultsLines.length > 8 ? undefined : false}>
                    <Text style={styles.sectionTitle}>Results</Text>
                    {resultsLines.map((ln, i) => (
                      <View key={i} style={{ flexDirection: 'row', marginBottom: 3, paddingLeft: 8 * ln.depth }}>
                        {ln.value === null ? (
                          <Text style={styles.nestedSubtitle}>{safeString(ln.label)}</Text>
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
              )}
            </View>
          );
        })}

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Protected Health Information (PHI) - Handle according to HIPAA guidelines</Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
};

export default PsychiatricReviewDocumentPDFTemplate;
