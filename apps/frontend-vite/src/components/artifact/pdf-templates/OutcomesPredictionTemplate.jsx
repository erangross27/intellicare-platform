/**
 * OutcomesPredictionTemplate.jsx
 * March 2026 — Helvetica — LETTER size — outcomes prediction
 * Collection: outcomes_prediction
 *
 * Fields (from unified-medical-schemas.json):
 *   prognosis (string), priority (string enum), modifiableFactors (array of objects), expectedOutcomes (string)
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#000000', textAlign: 'center', marginBottom: 4 },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordDateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  recordDate: { fontSize: 11, color: '#000000', fontFamily: 'Helvetica' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#000000', marginBottom: 2 },
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

const fmtVal = (v) => {
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return String(v);
  return String(v || '');
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

/* renderFieldRow: label + value inside fieldBox */
const renderFieldRow = (label, value) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{safeString(fmtVal(value))}</Text>
    </View>
  );
};

/* renderSentenceField: split string fields into numbered sentences for PDF */
const renderSentenceField = (label, value) => {
  if (!hasVal(value)) return null;
  const strVal = fmtVal(value);
  const sentences = splitBySentence(strVal);

  if (sentences.length <= 1) {
    return renderFieldRow(label, value);
  }

  let n = 1;
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {sentences.map((sentence, sIdx) => {
        const parsed = parseLabel(sentence);
        if (parsed.isLabeled) {
          const commaItems = splitByComma(parsed.value);
          if (commaItems.length >= 2) {
            const items = [];
            items.push(<Text key={`lbl-${sIdx}`} style={styles.nestedSubtitle}>{parsed.label}:</Text>);
            commaItems.forEach((ci, ciIdx) => {
              items.push(<Text key={`${sIdx}-${ciIdx}`} style={styles.listItem}>{n++}. {ci}</Text>);
            });
            return <View key={sIdx}>{items}</View>;
          }
          return (
            <View key={sIdx}>
              <Text style={styles.nestedSubtitle}>{parsed.label}:</Text>
              <Text style={styles.listItem}>{n++}. {parsed.value}</Text>
            </View>
          );
        }
        return <Text key={sIdx} style={styles.listItem}>{n++}. {sentence}</Text>;
      })}
    </View>
  );
};

const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/* renderArrayBox: array field as numbered list */
const renderArrayBox = (label, value) => {
  if (!hasVal(value)) return null;
  const items = (Array.isArray(value) ? value : [value]).filter(hasVal);
  if (items.length === 0) return null;
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {items.map((it, i) => (
        <Text key={i} style={styles.listItem}>{i + 1}. {typeof it === 'object' ? (safeString(it.recommendation || it.text) || JSON.stringify(it)) : safeString(it)}</Text>
      ))}
    </View>
  );
};

/* renderObjectBox: object field — flat key/value leaves */
const renderObjectLeaves = (value, depth = 0) => {
  const out = [];
  Object.entries(value || {}).forEach(([k, v], i) => {
    if (!hasVal(v)) return;
    if (typeof v === 'object' && !Array.isArray(v) && !(v && v.$date)) {
      out.push(<Text key={`${depth}-${i}-k`} style={styles.nestedSubtitle}>{humanizeKey(k)}:</Text>);
      renderObjectLeaves(v, depth + 1).forEach(node => out.push(node));
    } else {
      const val = Array.isArray(v) ? v.map(safeString).join(', ') : safeString(v);
      out.push(<Text key={`${depth}-${i}`} style={[styles.listItem, depth > 0 ? { paddingLeft: 16 } : null]}>{humanizeKey(k)}: {val}</Text>);
    }
  });
  return out;
};

const renderObjectBox = (label, value) => {
  if (!hasVal(value) || typeof value !== 'object') return null;
  const leaves = renderObjectLeaves(value);
  if (leaves.length === 0) return null;
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {leaves}
    </View>
  );
};

/* ======= MAIN COMPONENT ======= */
const OutcomesPredictionTemplate = ({ document: docProp, documents }) => {
  const records = (() => {
    if (documents && Array.isArray(documents) && documents.length > 0) return documents;
    if (!docProp) return [];
    let arr = Array.isArray(docProp) ? docProp : [docProp];
    arr = arr.flatMap(r => {
      if (r?.outcomes_prediction) return Array.isArray(r.outcomes_prediction) ? r.outcomes_prediction : [r.outcomes_prediction];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.outcomes_prediction) return Array.isArray(dd.outcomes_prediction) ? dd.outcomes_prediction : [dd.outcomes_prediction]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  })();

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.noDataText}>No outcomes prediction records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Outcomes & Predictions</Text>
        </View>

        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View style={styles.recordHeader} wrap={false}>
              <View style={styles.recordDateRow}>
                {hasVal(record.date || record.createdAt) && (
                  <Text style={styles.recordDate}>{formatDate(record.date || record.createdAt)}</Text>
                )}
              </View>
              <Text style={styles.recordTitle}>{record.priority ? `${record.priority} Priority` : `Outcomes Prediction ${idx + 1}`}</Text>
            </View>

            {/* Prognosis Section */}
            {(hasVal(record.prognosis) || hasVal(record.priority)) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Prognosis</Text>
                {renderSentenceField('Prognosis', record.prognosis)}
                {renderFieldRow('Priority', record.priority)}
              </View>
            )}

            {/* Modifiable Factors Section */}
            {hasVal(record.modifiableFactors) && Array.isArray(record.modifiableFactors) && record.modifiableFactors.length > 0 && (
              <View style={styles.section} wrap={record.modifiableFactors.length > 8 ? undefined : false}>
                <Text style={styles.sectionTitle}>Modifiable Factors ({record.modifiableFactors.length})</Text>
                {record.modifiableFactors.map((mf, mfIdx) => (
                  <View key={mfIdx} style={{ marginBottom: 10 }}>
                    <Text style={[styles.fieldValue, { fontFamily: 'Helvetica-Bold' }]}>
                      {mfIdx + 1}. {safeString(mf.factor)}
                    </Text>
                    {hasVal(mf.impact) && (
                      <Text style={[styles.listItem, { paddingLeft: 16 }]}>
                        Impact: {safeString(mf.impact)}
                      </Text>
                    )}
                    {hasVal(mf.recommendation) && (
                      <Text style={[styles.listItem, { paddingLeft: 16 }]}>
                        Recommendation: {safeString(mf.recommendation)}
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            )}

            {/* Expected Outcomes Section */}
            {hasVal(record.expectedOutcomes) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Expected Outcomes</Text>
                {renderSentenceField('Expected Outcomes', record.expectedOutcomes)}
              </View>
            )}

            {/* Clinical Section */}
            {(hasVal(record.date) || hasVal(record.provider) || hasVal(record.facility) || hasVal(record.findings) || hasVal(record.assessment) || hasVal(record.plan) || hasVal(record.recommendations) || hasVal(record.results)) && (
              <View style={styles.section} wrap={[record.date, record.provider, record.facility, record.findings, record.assessment, record.plan, record.recommendations, record.results].filter(hasVal).length > 8 ? undefined : false}>
                <Text style={styles.sectionTitle}>Clinical</Text>
                {hasVal(record.date) && renderFieldRow('Date', formatDate(record.date))}
                {renderFieldRow('Provider', record.provider)}
                {renderFieldRow('Facility', record.facility)}
                {renderSentenceField('Findings', record.findings)}
                {renderSentenceField('Assessment', record.assessment)}
                {renderSentenceField('Plan', record.plan)}
                {renderArrayBox('Recommendations', record.recommendations)}
                {renderObjectBox('Results', record.results)}
              </View>
            )}

            {/* Notes & Status Section */}
            {(hasVal(record.notes) || hasVal(record.status)) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Notes & Status</Text>
                {renderSentenceField('Notes', record.notes)}
                {renderFieldRow('Status', record.status)}
              </View>
            )}

            {/* Predictions Section */}
            {hasVal(record.predictions) && Array.isArray(record.predictions) && record.predictions.length > 0 && (
              <View style={styles.section} wrap={record.predictions.length > 8 ? undefined : false}>
                <Text style={styles.sectionTitle}>Outcome Predictions ({record.predictions.length})</Text>
                {record.predictions.map((pred, pIdx) => (
                  <View key={pIdx} style={{ marginBottom: 10 }}>
                    <Text style={[styles.fieldValue, { fontFamily: 'Helvetica-Bold' }]}>
                      {pIdx + 1}. {safeString(pred.outcome || pred.condition)}
                    </Text>
                    {hasVal(pred.probability || pred.risk) && (
                      <Text style={[styles.listItem, { paddingLeft: 16 }]}>
                        Probability: {safeString(pred.probability || pred.risk)}
                      </Text>
                    )}
                    {hasVal(pred.riskLevel) && (
                      <Text style={[styles.listItem, { paddingLeft: 16 }]}>
                        Risk Level: {safeString(pred.riskLevel)}
                      </Text>
                    )}
                    {hasVal(pred.timeframe) && (
                      <Text style={[styles.listItem, { paddingLeft: 16 }]}>
                        Timeframe: {safeString(pred.timeframe)}
                      </Text>
                    )}
                    {hasVal(pred.confidenceInterval) && (
                      <Text style={[styles.listItem, { paddingLeft: 16 }]}>
                        Confidence Interval: {safeString(pred.confidenceInterval)}
                      </Text>
                    )}
                    {pred.contributingFactors && pred.contributingFactors.length > 0 && (
                      <View>
                        <Text style={[styles.nestedSubtitle, { paddingLeft: 16 }]}>Contributing Factors:</Text>
                        {pred.contributingFactors.map((f, fIdx) => (
                          <Text key={fIdx} style={[styles.listItem, { paddingLeft: 28 }]}>- {safeString(f)}</Text>
                        ))}
                      </View>
                    )}
                    {pred.mitigationStrategies && pred.mitigationStrategies.length > 0 && (
                      <View>
                        <Text style={[styles.nestedSubtitle, { paddingLeft: 16 }]}>Mitigation Strategies:</Text>
                        {pred.mitigationStrategies.map((s, sIdx) => (
                          <Text key={sIdx} style={[styles.listItem, { paddingLeft: 28 }]}>- {safeString(s)}</Text>
                        ))}
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}

            {/* Risk Overview Section */}
            {(hasVal(record.mortalityRisk) || hasVal(record.readmissionRisk) || hasVal(record.riskScores)) && (
              <View style={styles.section} wrap={[record.mortalityRisk, record.mortalityTimeframe, record.readmissionRisk, record.readmissionTimeframe, record.riskScores].filter(hasVal).length > 8 ? undefined : false}>
                <Text style={styles.sectionTitle}>Risk Overview</Text>
                {hasVal(record.mortalityRisk) && renderFieldRow('Mortality Risk', record.mortalityRisk)}
                {hasVal(record.mortalityTimeframe) && renderFieldRow('Mortality Timeframe', record.mortalityTimeframe)}
                {hasVal(record.readmissionRisk) && renderFieldRow('Readmission Risk', record.readmissionRisk)}
                {hasVal(record.readmissionTimeframe) && renderFieldRow('Readmission Timeframe', record.readmissionTimeframe)}
                {hasVal(record.riskScores) && (
                  <View style={styles.fieldBox}>
                    <Text style={styles.fieldLabel}>Risk Scores</Text>
                    {Object.entries(record.riskScores).map(([key, value], sIdx) => (
                      <Text key={sIdx} style={styles.listItem}>
                        {key}: {typeof value === 'object' ? JSON.stringify(value) : safeString(value)}
                      </Text>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Risk Factors Section */}
            {(hasVal(record.complicationRisks) || hasVal(record.protectiveFactors) || hasVal(record.modifiableRiskFactors) || hasVal(record.nonModifiableRiskFactors)) && (
              <View style={styles.section} wrap={[record.complicationRisks, record.protectiveFactors, record.modifiableRiskFactors, record.nonModifiableRiskFactors].filter(hasVal).length > 8 ? undefined : false}>
                <Text style={styles.sectionTitle}>Risk Factors</Text>
                {hasVal(record.complicationRisks) && (
                  <View style={styles.fieldBox}>
                    <Text style={styles.fieldLabel}>Complication Risks</Text>
                    {record.complicationRisks.map((risk, rIdx) => (
                      <Text key={rIdx} style={styles.listItem}>
                        {rIdx + 1}. {typeof risk === 'object' ? `${safeString(risk.complication)}: ${safeString(risk.probability || risk.risk)}` : safeString(risk)}
                      </Text>
                    ))}
                  </View>
                )}
                {hasVal(record.protectiveFactors) && (
                  <View style={styles.fieldBox}>
                    <Text style={styles.fieldLabel}>Protective Factors</Text>
                    {record.protectiveFactors.map((f, fIdx) => (
                      <Text key={fIdx} style={styles.listItem}>{fIdx + 1}. {safeString(f)}</Text>
                    ))}
                  </View>
                )}
                {hasVal(record.modifiableRiskFactors) && (
                  <View style={styles.fieldBox}>
                    <Text style={styles.fieldLabel}>Modifiable Risk Factors</Text>
                    {record.modifiableRiskFactors.map((f, fIdx) => (
                      <Text key={fIdx} style={styles.listItem}>{fIdx + 1}. {safeString(f)}</Text>
                    ))}
                  </View>
                )}
                {hasVal(record.nonModifiableRiskFactors) && (
                  <View style={styles.fieldBox}>
                    <Text style={styles.fieldLabel}>Non-Modifiable Risk Factors</Text>
                    {record.nonModifiableRiskFactors.map((f, fIdx) => (
                      <Text key={fIdx} style={styles.listItem}>{fIdx + 1}. {safeString(f)}</Text>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Intervention Recommendations Section */}
            {hasVal(record.interventionRecommendations) && Array.isArray(record.interventionRecommendations) && record.interventionRecommendations.length > 0 && (
              <View style={styles.section} wrap={record.interventionRecommendations.length > 8 ? undefined : false}>
                <Text style={styles.sectionTitle}>Intervention Recommendations ({record.interventionRecommendations.length})</Text>
                {record.interventionRecommendations.map((rec, rIdx) => (
                  <View key={rIdx} style={{ marginBottom: 6 }}>
                    {typeof rec === 'object' ? (
                      <View>
                        <Text style={[styles.fieldValue, { fontFamily: 'Helvetica-Bold' }]}>
                          {rIdx + 1}. {safeString(rec.intervention)}
                        </Text>
                        {hasVal(rec.expectedImpact) && (
                          <Text style={[styles.listItem, { paddingLeft: 16 }]}>
                            Expected Impact: {safeString(rec.expectedImpact)}
                          </Text>
                        )}
                        {hasVal(rec.priority) && (
                          <Text style={[styles.listItem, { paddingLeft: 16 }]}>
                            Priority: {safeString(rec.priority)}
                          </Text>
                        )}
                      </View>
                    ) : (
                      <Text style={styles.listItem}>{rIdx + 1}. {safeString(rec)}</Text>
                    )}
                  </View>
                ))}
              </View>
            )}

            {idx < records.length - 1 && <View style={styles.separator} />}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default OutcomesPredictionTemplate;
