/**
 * DementiaAssessmentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — parseLabel + comma-split — no boxes (fieldBox has no border)
 * Collection: dementia_assessment
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 20, paddingBottom: 8 },
  title: { fontSize: 26, fontFamily: 'Helvetica-Bold', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1 },
  recordContainer: { marginBottom: 0, paddingBottom: 16 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', marginBottom: 8 },
  section: { paddingBottom: 4 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 4, textTransform: 'uppercase', borderBottomWidth: 1, borderBottomColor: '#000000', paddingBottom: 2 },
  fieldBox: { marginBottom: 6 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#000000', marginBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', paddingBottom: 2 },
  fieldValue: { fontSize: 14, lineHeight: 1.4, color: '#000000' },
  listItem: { fontSize: 14, lineHeight: 1.4, marginBottom: 2, paddingLeft: 12 },
  nestedSubtitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', paddingBottom: 2 },
  subLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 2, marginBottom: 1, borderBottomWidth: 0.5, borderBottomColor: '#999999', paddingBottom: 1 },
  nested: { marginLeft: 8, paddingLeft: 6 },
  medCard: { marginBottom: 6 },
  medName: { fontSize: 14, fontFamily: 'Helvetica-Bold', marginBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', paddingBottom: 2 },
  /* Bar chart styles (B&W greyscale chart) */
  chartContainer: { padding: 6, marginBottom: 4 },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginRight: 12 },
  legendDot: { width: 8, height: 8, marginRight: 3 },
  legendText: { fontSize: 10, color: '#000000' },
  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2, gap: 4 },
  barLabel: { width: 40, fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#000000', textAlign: 'right' },
  barBackground: { flex: 1, height: 10, backgroundColor: '#eeeeee' },
  barFill: { height: '100%', minWidth: 3 },
  barValue: { width: 32, fontSize: 10, fontFamily: 'Helvetica-Bold', textAlign: 'right' },
  barInterpretation: { width: 52, fontSize: 10, fontFamily: 'Helvetica-Bold', textAlign: 'right' },
  emptyState: { textAlign: 'center', padding: 20, fontSize: 12, color: '#999999' },
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
const stripNumber = (t) => t ? t.replace(/^\d+[.)]\s*/, '') : t || '';

const stripDelims = (t) => String(t || '').replace(/^[\s.;,]+/, '').replace(/[\s.;,]+$/, '').trim();

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|approx|no|No))\s*[.;]\s+/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};

const splitBySemicolon = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/;\s*/).map(s => s.trim()).filter(Boolean);
};

const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.'"-]{1,80}?):\s+([\s\S]*)/);
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

const splitFuncStatus = (text) => {
  if (!text) return [];
  const groups = String(text).split(/;\s*/).map(s => s.trim()).filter(Boolean);
  const allParts = [];
  groups.forEach(group => {
    const items = group.split(/,\s*/).map(s => s.trim().replace(/^and\s+/i, '')).filter(Boolean);
    allParts.push(...items);
  });
  return allParts;
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try { return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateStr); }
};

const parseFunctionalScore = (text) => {
  if (!text) return null;
  const match = String(text).match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
  if (!match) return null;
  return { value: parseFloat(match[1]), max: parseFloat(match[2]) };
};

const getBarColor = (pct) => { if (pct >= 80) return '#000000'; if (pct >= 50) return '#666666'; return '#999999'; };
const getInterpretation = (pct) => { if (pct >= 80) return 'Normal'; if (pct >= 50) return 'Mild'; return 'Impaired'; };

/* ═══ OBJECT (results) HELPERS ═══ */
const KEY_OVERRIDES = {};
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key];
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
const isScalar = (v) => v === null || typeof v !== 'object';
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };

/* recursive object node: label = bold heading; scalar value = numbered line below ("1." even for singles) */
const renderObjectNode = (label, value, keyPath, depth) => {
  if (isEmptyDeep(value)) return null;
  const LabelTag = depth > 0 ? styles.subLabel : styles.fieldLabel;
  if (isScalar(value)) {
    return (
      <View key={keyPath}>
        {label ? <Text style={LabelTag}>{safeString(label)}</Text> : null}
        <Text style={styles.listItem}>1. {safeString(fmtScalar(value))}</Text>
      </View>
    );
  }
  const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
  if (entries.length === 0) return null;
  return (
    <View key={keyPath}>
      {label ? <Text style={LabelTag}>{safeString(label)}</Text> : null}
      <View style={label ? styles.nested : undefined}>{entries.map(([k, v]) => renderObjectNode(humanizeKey(k), v, `${keyPath}-${k}`, depth + 1))}</View>
    </View>
  );
};

/* count rows for wrap heuristic */
const countRows = (val) => {
  if (isEmptyDeep(val)) return 0;
  if (isScalar(val)) return 1;
  if (Array.isArray(val)) { let n = 0; val.filter(x => !isEmptyDeep(x)).forEach(it => { n += isScalar(it) ? 1 : 1 + countRows(it); }); return n; }
  let n = 0; Object.values(val).forEach(sub => { if (!isEmptyDeep(sub)) n += isScalar(sub) ? 2 : 1 + countRows(sub); }); return n;
};

const SAFETY_LABELS = { driving: 'Driving', homeAlone: 'Home Alone Safety', medication: 'Medication Management', wandering: 'Wandering Risk' };
const DIRECTIVE_LABELS = { healthcarePowerOfAttorney: 'Healthcare Power of Attorney', livingWill: 'Living Will', financialPowerOfAttorney: 'Financial Power of Attorney' };
const MED_FIELDS = [{ key: 'dose', label: 'Dose' }, { key: 'frequency', label: 'Frequency' }, { key: 'status', label: 'Status' }, { key: 'plan', label: 'Plan' }];

/* renderSentenceSection: parseLabel + comma-split (>=3) for heavy text fields.
   Single-name sections: the title IS the section title (16pt + 1pt rule) — no duplicate field label.
   Labeled groups restart numbering at 1; unlabeled rows continue the running count. */
const renderSentenceSection = (title, text) => {
  if (!hasVal(text)) return null;
  const sentences = splitBySentence(fmtVal(text));
  if (sentences.length === 0) return null;

  const rows = [];
  let n = 1;
  sentences.forEach(s => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const rawComma = splitByComma(parsed.value);
      const commaItems = rawComma.length >= 3 ? rawComma : [parsed.value];
      rows.push({ type: 'subtitle', text: safeString(parsed.label) });
      commaItems.forEach((ci, i) => { rows.push({ type: 'item', text: safeString(stripDelims(ci)), num: i + 1 }); });
    } else {
      rows.push({ type: 'item', text: safeString(stripDelims(s)), num: n++ });
    }
  });

  return (
    <View style={styles.fieldBox} wrap={rows.length > 8 ? true : false}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {rows.map((row, i) => {
        if (row.type === 'subtitle') {
          return <Text key={i} style={styles.nestedSubtitle}>{row.text}</Text>;
        }
        return <Text key={i} style={styles.listItem}>{row.num}. {row.text}</Text>;
      })}
    </View>
  );
};

/* renderSemicolonSection: split by semicolons for burden/plan/findings fields.
   Labeled items → sub-label + value row(s) (comma-split >=3, restart numbering); unlabeled → running count. */
const renderSemicolonSection = (title, text) => {
  if (!hasVal(text)) return null;
  const items = splitBySemicolon(fmtVal(text));
  if (items.length === 0) return null;

  const rows = [];
  let n = 1;
  items.forEach(item => {
    const parsed = parseLabel(stripNumber(item));
    if (parsed.isLabeled) {
      const rawComma = splitByComma(parsed.value);
      const parts = rawComma.length >= 3 ? rawComma : [parsed.value];
      rows.push({ type: 'subtitle', text: safeString(parsed.label) });
      parts.forEach((p, i) => { rows.push({ type: 'item', text: safeString(stripDelims(p)), num: i + 1 }); });
    } else {
      rows.push({ type: 'item', text: safeString(stripNumber(item)), num: n++ });
    }
  });

  return (
    <View style={styles.fieldBox} wrap={rows.length > 8 ? true : false}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {rows.map((row, i) => {
        if (row.type === 'subtitle') return <Text key={i} style={styles.nestedSubtitle}>{row.text}</Text>;
        return <Text key={i} style={styles.listItem}>{row.num}. {row.text}</Text>;
      })}
    </View>
  );
};

/* ═══ COMPONENT ═══ */
const DementiaAssessmentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.dementia_assessment) return Array.isArray(r.dementia_assessment) ? r.dementia_assessment : [r.dementia_assessment];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.dementia_assessment) return Array.isArray(dd.dementia_assessment) ? dd.dementia_assessment : [dd.dementia_assessment]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}><Text style={styles.title}>Dementia Assessment</Text></View>
          <Text style={styles.emptyState}>No records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Dementia Assessment</Text></View>

        {records.map((record, idx) => {
          const symptoms = safeArray(record.behavioralSymptoms);
          const meds = safeArray(record.cognitiveEnhancers);
          const safetyEntries = record.safetyAssessment ? Object.entries(record.safetyAssessment).filter(([, v]) => hasVal(v)) : [];
          const directiveEntries = record.advanceDirectives ? Object.entries(record.advanceDirectives).filter(([, v]) => hasVal(v)) : [];

          /* Functional status bar chart data */
          const funcScores = ['adls', 'iadls'].map(key => {
            const parsed = parseFunctionalScore(record.functionalStatus?.[key]);
            if (!parsed) return null;
            const label = key === 'adls' ? 'ADLs' : 'IADLs';
            const pct = Math.min(100, Math.max(2, (parsed.value / parsed.max) * 100));
            return { key, label, ...parsed, percentage: pct, color: getBarColor(pct), interpretation: getInterpretation(pct), display: `${parsed.value}/${parsed.max}` };
          }).filter(Boolean);

          return (
            <View key={idx} style={styles.recordContainer} break={idx > 0}>
              {/* Record Header - title only (no pills, date in own section if present) */}
              <View wrap={false}>
                <Text style={styles.recordTitle}>{`Dementia Assessment ${idx + 1}`}</Text>
              </View>

              {/* Section 1: Dementia Overview */}
              {(hasVal(record.dementiaType) || hasVal(record.cdrsScore)) && (
                <View style={styles.section}>
                  <View style={styles.fieldBox} wrap={false}>
                    <Text style={styles.sectionTitle}>Dementia Overview</Text>
                    {hasVal(record.dementiaType) && (
                      <View style={{ marginBottom: 4 }} wrap={false}>
                        <Text style={styles.fieldLabel}>Dementia Type</Text>
                        <Text style={styles.fieldValue}>1. {safeString(record.dementiaType)}</Text>
                      </View>
                    )}
                    {hasVal(record.cdrsScore) && (() => {
                      const cdrParts = splitBySemicolon(String(record.cdrsScore));
                      return (
                        <View style={{ marginBottom: 4 }} wrap={false}>
                          <Text style={styles.nestedSubtitle}>CDRS Score</Text>
                          {cdrParts.map((part, pi) => {
                            const parsed = parseLabel(part);
                            if (parsed.isLabeled) {
                              const rawComma = splitByComma(parsed.value);
                              const sub = rawComma.length >= 3 ? rawComma : [parsed.value];
                              return (
                                <View key={pi} wrap={false}>
                                  <Text style={styles.subLabel}>{safeString(parsed.label)}</Text>
                                  {sub.map((sp, si) => <Text key={si} style={styles.listItem}>{si + 1}. {safeString(stripDelims(sp))}</Text>)}
                                </View>
                              );
                            }
                            return <Text key={pi} style={styles.listItem} wrap={false}>1. {safeString(part)}</Text>;
                          })}
                        </View>
                      );
                    })()}
                  </View>
                </View>
              )}

              {/* Section 2: Functional Status */}
              {(hasVal(record.functionalStatus?.adls) || hasVal(record.functionalStatus?.iadls)) && (
                <View style={styles.section}>
                  {/* Bar chart */}
                  {funcScores.length > 0 && (
                    <View style={styles.chartContainer} wrap={false}>
                      <Text style={styles.sectionTitle}>Functional Status</Text>
                      <View style={styles.legendRow}>
                        <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#000000' }]} /><Text style={styles.legendText}>Normal (&gt;=80%)</Text></View>
                        <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#666666' }]} /><Text style={styles.legendText}>Mild (50-79%)</Text></View>
                        <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#999999' }]} /><Text style={styles.legendText}>Impaired (&lt;50%)</Text></View>
                      </View>
                      {funcScores.map((s, si) => (
                        <View key={si} style={styles.barRow}>
                          <Text style={styles.barLabel}>{s.label}</Text>
                          <View style={styles.barBackground}>
                            <View style={[styles.barFill, { width: `${s.percentage}%`, backgroundColor: s.color }]} />
                          </View>
                          <Text style={[styles.barValue, { color: s.color }]}>{s.display}</Text>
                          <Text style={[styles.barInterpretation, { color: s.color }]}>{s.interpretation}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  {/* Detailed descriptions */}
                  <View style={styles.fieldBox}>
                    {funcScores.length === 0 && <Text style={styles.sectionTitle}>Functional Status</Text>}
                    {hasVal(record.functionalStatus?.adls) && (
                      <View style={{ marginBottom: 4 }}>
                        <Text style={styles.fieldLabel}>ADLs</Text>
                        {splitFuncStatus(safeString(record.functionalStatus.adls)).map((part, pi) => (
                          <Text key={pi} style={styles.listItem}>{pi + 1}. {safeString(part)}</Text>
                        ))}
                      </View>
                    )}
                    {hasVal(record.functionalStatus?.iadls) && (
                      <View style={{ marginBottom: 4 }}>
                        <Text style={styles.fieldLabel}>IADLs</Text>
                        {splitFuncStatus(safeString(record.functionalStatus.iadls)).map((part, pi) => (
                          <Text key={pi} style={styles.listItem}>{pi + 1}. {safeString(part)}</Text>
                        ))}
                      </View>
                    )}
                  </View>
                </View>
              )}

              {/* Section 3: Behavioral Symptoms */}
              {symptoms.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.fieldBox} wrap={symptoms.length > 8 ? true : false}>
                    <Text style={styles.sectionTitle}>Behavioral Symptoms</Text>
                    {symptoms.map((s, i) => (
                      <Text key={i} style={styles.listItem}>{i + 1}. {safeString(stripNumber(s))}</Text>
                    ))}
                  </View>
                </View>
              )}

              {/* Section 4: Cognitive Enhancers */}
              {meds.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.fieldBox} wrap={meds.length > 4 ? true : false}>
                    <Text style={styles.sectionTitle}>Cognitive Enhancers</Text>
                    {meds.map((med, mi) => (
                      <View key={mi} style={styles.medCard}>
                        <Text style={styles.medName}>{safeString(med.medication || `Medication ${mi + 1}`)}</Text>
                        {MED_FIELDS.map(field => {
                          const val = med[field.key];
                          if (!hasVal(val)) return null;
                          return (
                            <View key={field.key} wrap={false}>
                              <Text style={styles.subLabel}>{field.label}</Text>
                              <Text style={styles.listItem}>1. {safeString(fmtVal(val))}</Text>
                            </View>
                          );
                        })}
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Section 5: Caregiver Burden */}
              {hasVal(record.caregiverBurden) && (
                <View style={styles.section}>
                  {renderSemicolonSection('Caregiver Burden', record.caregiverBurden)}
                </View>
              )}

              {/* Section 6: Safety Assessment */}
              {safetyEntries.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.fieldBox} wrap={safetyEntries.length > 4 ? true : false}>
                    <Text style={styles.sectionTitle}>Safety Assessment</Text>
                    {safetyEntries.map(([key, val]) => {
                      const parts = splitBySemicolon(safeString(val));
                      return (
                        <View key={key} style={{ marginBottom: 4 }}>
                          <Text style={styles.fieldLabel}>{SAFETY_LABELS[key] || key}</Text>
                          {parts.map((part, pi) => <Text key={pi} style={styles.listItem}>{pi + 1}. {safeString(stripNumber(part))}</Text>)}
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Section 7: Advance Directives */}
              {directiveEntries.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.fieldBox} wrap={false}>
                    <Text style={styles.sectionTitle}>Advance Directives</Text>
                    {directiveEntries.map(([key, val]) => (
                      <View key={key} style={{ marginBottom: 4 }}>
                        <Text style={styles.fieldLabel}>{DIRECTIVE_LABELS[key] || key}</Text>
                        <Text style={styles.listItem}>1. {safeString(fmtVal(val))}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Section 8: Findings — semicolon-split with numbering */}
              {hasVal(record.findings) && (
                <View style={styles.section}>
                  {renderSemicolonSection('Findings', record.findings)}
                </View>
              )}

              {/* Section 9: Assessment */}
              {hasVal(record.assessment) && (
                <View style={styles.section}>
                  {renderSentenceSection('Assessment', record.assessment)}
                </View>
              )}

              {/* Section 10: Plan */}
              {hasVal(record.plan) && (
                <View style={styles.section}>
                  {renderSemicolonSection('Plan', record.plan)}
                </View>
              )}

              {/* Section: Results — recursive object */}
              {hasVal(record.results) && !isScalar(record.results) && (() => {
                const entries = Object.entries(record.results).filter(([, v]) => !isEmptyDeep(v));
                if (entries.length === 0) return null;
                return (
                  <View style={styles.section}>
                    {entries.map(([k, v], i) => {
                      const rows = countRows(v);
                      return (
                        <View key={`results-${k}`} style={styles.fieldBox} wrap={rows > 8 ? true : false}>
                          {i === 0 && <Text style={styles.sectionTitle}>Results</Text>}
                          {renderObjectNode(humanizeKey(k), v, `results-${k}`, 1)}
                        </View>
                      );
                    })}
                  </View>
                );
              })()}

              {/* Section: Recommendations — array of {recommendation, date}, date-grouped */}
              {(() => {
                const recs = safeArray(record.recommendations);
                if (recs.length === 0) return null;
                const groups = [];
                recs.forEach((r) => { const d = (r?.date || '').trim(); const last = groups[groups.length - 1]; if (last && last.date === d) last.items.push(r); else groups.push({ date: d, items: [r] }); });
                let runningN = 1;
                return (
                  <View style={styles.section}>
                    <View style={styles.fieldBox} wrap={recs.length > 8 ? true : false}>
                      <Text style={styles.sectionTitle}>Recommendations</Text>
                      {groups.map((group, gIdx) => (
                        <View key={gIdx}>
                          {group.date ? <Text style={styles.nestedSubtitle}>{safeString(group.date)}</Text> : null}
                          {group.items.map((r, i) => (<Text key={i} style={styles.listItem}>{group.date ? i + 1 : runningN++}. {safeString((r?.recommendation || '').trim())}</Text>))}
                        </View>
                      ))}
                    </View>
                  </View>
                );
              })()}

              {/* Section: Notes — per-sentence narrative with parseLabel (mirrors Copy) */}
              {hasVal(record.notes) && (
                <View style={styles.section}>
                  {renderSentenceSection('Notes', record.notes)}
                </View>
              )}

              {/* Section 11: Provider Information (date + provider + facility) */}
              {(hasVal(record.date) || hasVal(record.provider) || hasVal(record.facility)) && (
                <View style={styles.section}>
                  <View style={styles.fieldBox} wrap={false}>
                    <Text style={styles.sectionTitle}>Provider Information</Text>
                    {hasVal(record.date) && (
                      <View style={{ marginBottom: 4 }}>
                        <Text style={styles.fieldLabel}>Date</Text>
                        <Text style={styles.listItem}>1. {safeString(formatDate(record.date))}</Text>
                      </View>
                    )}
                    {hasVal(record.provider) && (() => {
                      const providers = String(record.provider).split(/;\s*/).map(s => s.trim()).filter(Boolean);
                      return (
                        <View style={{ marginBottom: 4 }}>
                          <Text style={styles.fieldLabel}>Provider</Text>
                          {providers.map((prov, pi) => (
                            <Text key={pi} style={styles.listItem}>{pi + 1}. {safeString(prov)}</Text>
                          ))}
                        </View>
                      );
                    })()}
                    {hasVal(record.facility) && (
                      <View style={{ marginBottom: 4 }}>
                        <Text style={styles.fieldLabel}>Facility</Text>
                        <Text style={styles.listItem}>1. {safeString(record.facility)}</Text>
                      </View>
                    )}
                  </View>
                </View>
              )}
            </View>
          );
        })}

      </Page>
    </Document>
  );
};

export default DementiaAssessmentPDFTemplate;
