/**
 * PsychosocialAssessmentsDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — psychosocial assessments
 * Collection: psychosocial_assessments
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#606060', borderBottomStyle: 'solid' },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#1f2937', textAlign: 'center', marginBottom: 4 },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#606060', borderBottomStyle: 'solid' },
  recordDateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  recordDate: { fontSize: 11, color: '#6b7280', fontFamily: 'Helvetica' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#1f2937' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#606060', marginBottom: 8 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#333333', marginBottom: 2 },
  fieldValue: { fontSize: 11, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 11, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#d1d5db', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 12, color: '#6b7280', textAlign: 'center', marginTop: 40 },
});

/* Chart styles */
const chartStyles = StyleSheet.create({
  chartSection: { marginBottom: 14, padding: 10, backgroundColor: '#f8f9fa', borderRadius: 4 },
  chartTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', marginBottom: 8, color: '#606060' },
  legendContainer: { flexDirection: 'row', justifyContent: 'center', marginBottom: 8, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: '#e5e5e5', flexWrap: 'wrap', gap: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginRight: 12 },
  legendColor: { width: 10, height: 10, marginRight: 4, borderRadius: 2 },
  legendText: { fontSize: 8, color: '#666666' },
  barChartRow: { marginBottom: 10 },
  barLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#333333', marginBottom: 3 },
  barContainer: { flexDirection: 'row', alignItems: 'center', height: 14 },
  barBackground: { flex: 1, height: 12, backgroundColor: '#e5e5e5', borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  barValue: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#333333', marginLeft: 6, width: 35, textAlign: 'right' },
  barInterpretation: { fontSize: 9, marginTop: 2, paddingLeft: 2 },
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

/* ======= Score extraction ======= */
const extractPHQ9Score = (text) => {
  if (!text) return null;
  const match = String(text).match(/PHQ-?9[:\s]+(\d+)/i);
  if (match) return { value: parseInt(match[1], 10), max: 27, raw: `${match[1]}/27` };
  return null;
};

const extractGAD7Score = (text) => {
  if (!text) return null;
  const match = String(text).match(/GAD-?7[:\s]+(?:score\s+)?(\d+)(?:\/(\d+))?/i);
  if (match) { const v = parseInt(match[1], 10); const mx = match[2] ? parseInt(match[2], 10) : 21; return { value: v, max: mx, raw: `${v}/${mx}` }; }
  return null;
};

const extractSocialIsolationScore = (text) => {
  if (!text) return null;
  const match = String(text).match(/Social\s+Isolation\s+Score[:\s]+(\d+)(?:\/(\d+))?/i);
  if (match) { const v = parseInt(match[1], 10); const mx = match[2] ? parseInt(match[2], 10) : 10; return { value: v, max: mx, raw: `${v}/${mx}` }; }
  return null;
};

const getRiskScoreColor = (pct) => { if (pct <= 25) return '#898989'; if (pct <= 50) return '#7a7a7a'; if (pct <= 75) return '#a7a7a7'; return '#777777'; };
const getPHQ9Interpretation = (s) => { if (s <= 4) return 'Minimal'; if (s <= 9) return 'Mild'; if (s <= 14) return 'Moderate'; if (s <= 19) return 'Moderately Severe'; return 'Severe'; };
const getGAD7Interpretation = (s) => { if (s <= 4) return 'Minimal'; if (s <= 9) return 'Mild'; if (s <= 14) return 'Moderate'; return 'Severe'; };
const getSocialIsolationInterpretation = (s) => { if (s <= 2) return 'Well Connected'; if (s <= 4) return 'Mild Isolation'; if (s <= 6) return 'Moderate Isolation'; return 'Severe Isolation'; };

const prepareChartData = (record) => {
  const charts = [];
  const phq9 = extractPHQ9Score(String(record.findings || ''));
  if (phq9 && phq9.value > 0) { const p = (phq9.value / phq9.max) * 100; charts.push({ label: 'PHQ-9 (Depression)', percentage: p, rawValue: phq9.raw, color: getRiskScoreColor(p), interpretation: getPHQ9Interpretation(phq9.value) }); }
  const gad7 = extractGAD7Score(String(record.anxietyScreening || ''));
  if (gad7 && gad7.value > 0) { const p = (gad7.value / gad7.max) * 100; charts.push({ label: 'GAD-7 (Anxiety)', percentage: p, rawValue: gad7.raw, color: getRiskScoreColor(p), interpretation: getGAD7Interpretation(gad7.value) }); }
  const si = extractSocialIsolationScore(String(record.socialSupport || ''));
  if (si && si.value > 0) { const p = (si.value / si.max) * 100; charts.push({ label: 'Social Isolation Score', percentage: p, rawValue: si.raw, color: getRiskScoreColor(p), interpretation: getSocialIsolationInterpretation(si.value) }); }
  return charts;
};

/* humanizeKey: dynamic object key -> readable label */
const humanizeKey = (key) => {
  if (!key) return '';
  return String(key)
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase());
};

/* flattenObject: recurse dynamic-key object into typed leaves (no [object Object]) */
const flattenObject = (obj, labelPrefix = '') => {
  const leaves = [];
  if (!obj || typeof obj !== 'object') return leaves;
  Object.keys(obj).forEach(k => {
    const val = obj[k];
    const label = labelPrefix ? `${labelPrefix} — ${humanizeKey(k)}` : humanizeKey(k);
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      leaves.push(...flattenObject(val, label));
    } else if (Array.isArray(val)) {
      const flat = val.map(item => (item !== null && typeof item === 'object') ? (item.name || item.value || JSON.stringify(item)) : String(item)).join(', ');
      if (flat.trim() !== '') leaves.push({ label, value: flat });
    } else if (val !== null && val !== undefined && String(val).trim() !== '') {
      leaves.push({ label, value: val });
    }
  });
  return leaves;
};

/* renderObjectSection: dynamic-key object -> humanized leaves */
const renderObjectSection = (label, obj) => {
  if (!hasVal(obj) || typeof obj !== 'object' || Array.isArray(obj)) return null;
  const leaves = flattenObject(obj);
  if (leaves.length === 0) return null;
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {leaves.map((leaf, i) => (
        <Text key={i} style={styles.listItem}>{safeString(leaf.label)}: {safeString(fmtVal(leaf.value))}</Text>
      ))}
    </View>
  );
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

/* renderDateField */
const renderDateFieldPDF = (label, value) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{formatDate(value)}</Text>
    </View>
  );
};

/* renderSentenceSection: parseLabel + comma-split */
const renderSentenceSection = (label, text) => {
  if (!hasVal(text)) return null;
  const sentences = splitBySentence(fmtVal(text));
  if (sentences.length === 0) return null;

  const rows = [];
  let n = 1;
  sentences.forEach(s => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const commaItems = splitByComma(parsed.value);
      if (commaItems.length >= 2) {
        rows.push({ type: 'subtitle', text: safeString(parsed.label) });
        commaItems.forEach(ci => { rows.push({ type: 'item', text: safeString(ci), num: n++ }); });
      } else {
        rows.push({ type: 'item', text: safeString(s), num: n++ });
      }
    } else {
      rows.push({ type: 'item', text: safeString(s), num: n++ });
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

/* PDF Legend */
const PDFLegend = () => (
  <View style={chartStyles.legendContainer}>
    <View style={chartStyles.legendItem}><View style={[chartStyles.legendColor, { backgroundColor: '#898989' }]} /><Text style={chartStyles.legendText}>Minimal (0-25%)</Text></View>
    <View style={chartStyles.legendItem}><View style={[chartStyles.legendColor, { backgroundColor: '#7a7a7a' }]} /><Text style={chartStyles.legendText}>Mild (26-50%)</Text></View>
    <View style={chartStyles.legendItem}><View style={[chartStyles.legendColor, { backgroundColor: '#a7a7a7' }]} /><Text style={chartStyles.legendText}>Moderate (51-75%)</Text></View>
    <View style={chartStyles.legendItem}><View style={[chartStyles.legendColor, { backgroundColor: '#777777' }]} /><Text style={chartStyles.legendText}>Severe (76-100%)</Text></View>
  </View>
);

/* PDF BarChart */
const PDFBarChart = ({ label, percentage, rawValue, color, interpretation }) => (
  <View style={chartStyles.barChartRow}>
    <Text style={chartStyles.barLabel}>{String(label)}</Text>
    <View style={chartStyles.barContainer}>
      <View style={chartStyles.barBackground}>
        <View style={[chartStyles.barFill, { width: `${percentage}%`, backgroundColor: color }]} />
      </View>
      <Text style={chartStyles.barValue}>{String(rawValue)}</Text>
    </View>
    <Text style={[chartStyles.barInterpretation, { color }]}>{String(interpretation)}</Text>
  </View>
);

/* SECTION CONFIGS */
const SECTION_CONFIGS = [
  {
    title: 'Assessment Information',
    fields: [
      { key: 'provider', label: 'Provider', isSentence: true },
      { key: 'facility', label: 'Facility', isSentence: true },
      { key: 'date', label: 'Date', isDate: true },
      { key: 'type', label: 'Type', isSentence: true },
    ],
  },
  {
    title: 'Screening Scores',
    fields: [
      { key: 'edinburghScore', label: 'Edinburgh Score', isSentence: true },
      { key: 'anxietyScreening', label: 'Anxiety Screening', isSentence: true },
      { key: 'domesticViolenceScreen', label: 'Domestic Violence Screen', isSentence: true },
    ],
  },
  {
    title: 'Social Support',
    fields: [
      { key: 'socialSupport', label: 'Social Support', isSentence: true },
    ],
  },
  {
    title: 'Psychosocial Factors',
    fields: [
      { key: 'housingStability', label: 'Housing Stability', isSentence: true },
      { key: 'financialConcerns', label: 'Financial Concerns', isSentence: true },
      { key: 'relationshipStress', label: 'Relationship Stress', isSentence: true },
      { key: 'previousPostpartumDepression', label: 'Previous Postpartum Depression' },
    ],
  },
  {
    title: 'Findings & Assessment',
    fields: [
      { key: 'findings', label: 'Findings', isSentence: true },
      { key: 'assessment', label: 'Assessment', isSentence: true },
    ],
  },
  {
    title: 'Plan & Recommendations',
    fields: [
      { key: 'plan', label: 'Plan', isSentence: true },
    ],
  },
  {
    title: 'Notes & Status',
    fields: [
      { key: 'notes', label: 'Notes', isSentence: true },
      { key: 'status', label: 'Status', isSentence: true },
    ],
  },
];

/* ======= COMPONENT ======= */
const PsychosocialAssessmentsDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.psychosocial_assessments) return Array.isArray(r.psychosocial_assessments) ? r.psychosocial_assessments : [r.psychosocial_assessments];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.psychosocial_assessments) return Array.isArray(dd.psychosocial_assessments) ? dd.psychosocial_assessments : [dd.psychosocial_assessments]; if (dd?.records) return Array.isArray(dd.records) ? dd.records : [dd.records]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Psychosocial Assessments</Text>
          </View>
          <Text style={styles.noDataText}>No data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Document Header */}
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Psychosocial Assessments</Text>
        </View>

        {records.map((record, index) => {
          const chartData = prepareChartData(record);

          return (
            <View key={index} style={styles.recordContainer}>
              {index > 0 && <View style={styles.separator} />}

              {/* Record Header */}
              <View style={styles.recordHeader} wrap={false}>
                <View style={styles.recordDateRow}>
                  {record.date && (
                    <Text style={styles.recordDate}>{formatDate(record.date)}</Text>
                  )}
                </View>
                <Text style={styles.recordTitle}>
                  {record.type || `Psychosocial Assessment ${index + 1}`}
                </Text>
              </View>

              {/* Score Overview Bar Chart */}
              {chartData.length > 0 && (
                <View style={chartStyles.chartSection} wrap={false}>
                  <Text style={chartStyles.chartTitle}>Score Overview</Text>
                  <PDFLegend />
                  {chartData.map((chart, cIdx) => (
                    <PDFBarChart key={cIdx} label={chart.label} percentage={chart.percentage} rawValue={chart.rawValue} color={chart.color} interpretation={chart.interpretation} />
                  ))}
                </View>
              )}

              {/* Sections */}
              {SECTION_CONFIGS.map((sectionConfig, sIdx) => {
                const hasAnyVal = sectionConfig.fields.some(f => hasVal(record[f.key]));
                if (!hasAnyVal) return null;

                return (
                  <View key={sIdx} style={styles.section}>
                    <Text style={styles.sectionTitle}>{sectionConfig.title}</Text>
                    {sectionConfig.fields.map((field, fIdx) => {
                      const val = record[field.key];
                      if (!hasVal(val)) return null;

                      if (field.isDate) return <View key={fIdx}>{renderDateFieldPDF(field.label, val)}</View>;
                      if (field.isSentence) return <View key={fIdx}>{renderSentenceSection(field.label, val)}</View>;
                      return <View key={fIdx}>{renderFieldRow(field.label, val)}</View>;
                    })}
                  </View>
                );
              })}

              {/* Substance Use Screening */}
              {record.substanceUseScreen && typeof record.substanceUseScreen === 'object' &&
               (record.substanceUseScreen.alcohol || record.substanceUseScreen.tobacco || record.substanceUseScreen.drugs) && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Substance Use Screening</Text>
                  {record.substanceUseScreen.alcohol && renderSentenceSection('Alcohol', record.substanceUseScreen.alcohol)}
                  {record.substanceUseScreen.tobacco && renderSentenceSection('Tobacco', record.substanceUseScreen.tobacco)}
                  {record.substanceUseScreen.drugs && renderSentenceSection('Drugs', record.substanceUseScreen.drugs)}
                </View>
              )}

              {/* Recommendations */}
              {record.recommendations && Array.isArray(record.recommendations) && record.recommendations.length > 0 && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Recommendations</Text>
                  {record.recommendations.map((rec, i) => {
                    const recText = typeof rec === 'string' ? rec : (rec?.recommendation || '');
                    const recDate = typeof rec === 'object' && rec?.date ? rec.date : null;
                    return (
                      <Text key={i} style={styles.listItem}>
                        {i + 1}. {safeString(recText)}{recDate ? ` (${safeString(recDate)})` : ''}
                      </Text>
                    );
                  })}
                </View>
              )}

              {/* Results (dynamic-key object) */}
              {record.results && typeof record.results === 'object' && !Array.isArray(record.results) &&
               flattenObject(record.results).length > 0 && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Results</Text>
                  {renderObjectSection('Results', record.results)}
                </View>
              )}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default PsychosocialAssessmentsDocumentPDFTemplate;
