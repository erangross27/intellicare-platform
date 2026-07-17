import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 13, color: '#000000', backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 20, textAlign: 'center', paddingBottom: 12 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', textAlign: 'center', borderBottom: '2pt solid #000000' },
  recordContainer: { marginBottom: 24, paddingBottom: 16 },
  recordHeader: { marginBottom: 12, paddingBottom: 8 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000' },
  recordSubtitle: { fontSize: 13, fontFamily: 'Helvetica', color: '#333333', marginTop: 2 },
  recordMeta: { flexDirection: 'column', gap: 2, marginTop: 6 },
  metaText: { fontSize: 13, color: '#333333' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', borderBottom: '1pt solid #000000', paddingBottom: 4, marginBottom: 8 },
  fieldBlock: { marginBottom: 8, paddingLeft: 12 },
  fieldLabel: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#333333', marginBottom: 2, paddingBottom: 2, borderBottom: '0.5pt solid #999999' },
  fieldValue: { fontSize: 13, color: '#000000', lineHeight: 1.4 },
  listItem: { fontSize: 13, color: '#000000', marginLeft: 15, marginBottom: 4 },
  noData: { fontSize: 12, color: '#666666', textAlign: 'center', marginTop: 40 },
});

const chartStyles = StyleSheet.create({
  chartSection: { marginBottom: 16 },
  chartTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#000000', textTransform: 'uppercase', marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#000000', paddingBottom: 4 },
  categoryHeader: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#757575', textTransform: 'uppercase', marginBottom: 8, marginTop: 8, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  legendContainer: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginBottom: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#dee2e6' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendColor: { width: 12, height: 12, borderRadius: 2 },
  legendText: { fontSize: 9, color: '#666666' },
  barChartRow: { marginBottom: 12 },
  barLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#333333', marginBottom: 4 },
  barContainer: { flexDirection: 'row', alignItems: 'center', height: 20, gap: 8 },
  barBackground: { flex: 1, height: 16, backgroundColor: '#e5e7eb', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  barValue: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#333333', width: 45, textAlign: 'right' },
  barInterpretation: { fontSize: 10, fontFamily: 'Helvetica-Bold', marginTop: 2 },
});

// Safe string conversion
const toSafeString = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (value.$date) return value.$date;
  if (Array.isArray(value)) return value.filter(Boolean).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    const date = dateString.$date ? new Date(dateString.$date) : new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return String(dateString);
  }
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/[.;]\s+/).map(s => s.trim()).filter(s => s.length > 0);
};

const formatKey = (key) => {
  return key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase()).trim();
};

// Detect a "Label: value" sentence (mirrors the JSX parseLabel) so the PDF can render the label as a
// bold heading and the value below it — never a side-by-side "Label: value" line.
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const match = text.match(/^([A-Z][A-Za-z0-9 &/()>=<+%.#-]+):\s*(.+)$/);
  if (match) return { isLabeled: true, label: match[1].trim(), value: match[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

// Empty value guard (handles empty arrays and strings)
const hasValue = (value) => {
  if (!value && value !== false && value !== 0) return false;
  if (Array.isArray(value) && value.length === 0) return false;
  if (typeof value === 'string' && value.trim() === '') return false;
  return true;
};

// Deep-empty guard for dynamic-key objects (e.g. results) — true if no populated leaf
const hasObjectValue = (obj) => {
  if (!obj || typeof obj !== 'object') return false;
  return Object.values(obj).some(v => {
    if (v && typeof v === 'object' && !Array.isArray(v)) return hasObjectValue(v);
    return hasValue(v);
  });
};

// Score interpretation functions
const getASAInterpretation = (score) => {
  if (score === 1) return { color: '#898989', text: 'Healthy Patient' };
  if (score === 2) return { color: '#7a7a7a', text: 'Mild Systemic Disease' };
  if (score === 3) return { color: '#a7a7a7', text: 'Severe Systemic Disease' };
  if (score === 4) return { color: '#777777', text: 'Life-Threatening Disease' };
  return { color: '#5c5c5c', text: 'Moribund Patient' };
};

const getMallampatiInterpretation = (score) => {
  if (score === 1) return { color: '#898989', text: 'Class I - Easy Intubation' };
  if (score === 2) return { color: '#7a7a7a', text: 'Class II - Moderate' };
  if (score === 3) return { color: '#a7a7a7', text: 'Class III - Difficult' };
  return { color: '#777777', text: 'Class IV - Very Difficult' };
};

const getPainInterpretation = (score) => {
  if (score === 0) return { color: '#898989', text: 'No Pain' };
  if (score <= 3) return { color: '#7a7a7a', text: 'Mild Pain' };
  if (score <= 6) return { color: '#a7a7a7', text: 'Moderate Pain' };
  return { color: '#777777', text: 'Severe Pain' };
};

const getSTOPBANGInterpretation = (score) => {
  if (score <= 2) return { color: '#898989', text: 'Low OSA Risk' };
  if (score <= 4) return { color: '#a7a7a7', text: 'Intermediate OSA Risk' };
  return { color: '#777777', text: 'High OSA Risk' };
};

const getRCRIInterpretation = (score) => {
  if (score === 0) return { color: '#898989', text: 'Very Low Cardiac Risk' };
  if (score === 1) return { color: '#7a7a7a', text: 'Low Cardiac Risk' };
  if (score === 2) return { color: '#a7a7a7', text: 'Moderate Cardiac Risk' };
  return { color: '#777777', text: 'High Cardiac Risk' };
};

const getApfelInterpretation = (score) => {
  if (score === 0) return { color: '#898989', text: 'Low PONV Risk (~10%)' };
  if (score === 1) return { color: '#7a7a7a', text: 'Low-Moderate (~20%)' };
  if (score === 2) return { color: '#a7a7a7', text: 'Moderate (~40%)' };
  if (score === 3) return { color: '#909090', text: 'Moderate-High (~60%)' };
  return { color: '#777777', text: 'High PONV Risk (~80%)' };
};

const extractASAScore = (asaText) => {
  if (!asaText) return null;
  const str = String(asaText).toUpperCase();
  const match = str.match(/ASA\s*(I{1,3}V?|IV|V|[1-5])/);
  if (match) {
    const roman = match[1];
    if (roman === 'I' || roman === '1') return 1;
    if (roman === 'II' || roman === '2') return 2;
    if (roman === 'III' || roman === '3') return 3;
    if (roman === 'IV' || roman === '4') return 4;
    if (roman === 'V' || roman === '5') return 5;
  }
  return null;
};

const extractMallampatiScore = (mallampatiText) => {
  if (!mallampatiText) return null;
  const str = String(mallampatiText).toUpperCase();
  const match = str.match(/CLASS\s*(I{1,3}V?|IV|[1-4])|^(I{1,3}V?|IV|[1-4])$/);
  if (match) {
    const value = match[1] || match[2];
    if (value === 'I' || value === '1') return 1;
    if (value === 'II' || value === '2') return 2;
    if (value === 'III' || value === '3') return 3;
    if (value === 'IV' || value === '4') return 4;
  }
  return null;
};

const extractScoreFromText = (text, pattern) => {
  if (!text) return null;
  const str = String(text);
  const match = str.match(pattern);
  if (match) return parseFloat(match[1]);
  return null;
};

const prepareChartData = (record) => {
  const charts = [];
  const asaScore = extractASAScore(record.asaClassification);
  if (asaScore !== null) {
    const interp = getASAInterpretation(asaScore);
    charts.push({ key: 'asa', label: 'ASA Physical Status', percentage: (asaScore / 5) * 100, rawValue: `ASA ${['I', 'II', 'III', 'IV', 'V'][asaScore - 1]}`, color: interp.color, interpretation: interp.text, category: 'Risk Assessment' });
  }
  const mallampatiScore = extractMallampatiScore(record.airwayAssessment?.mallampati);
  if (mallampatiScore !== null) {
    const interp = getMallampatiInterpretation(mallampatiScore);
    charts.push({ key: 'mallampati', label: 'Mallampati Score', percentage: (mallampatiScore / 4) * 100, rawValue: `Class ${['I', 'II', 'III', 'IV'][mallampatiScore - 1]}`, color: interp.color, interpretation: interp.text, category: 'Airway Assessment' });
  }
  if (record.painManagement?.currentPainScore != null) {
    const painScore = parseFloat(record.painManagement.currentPainScore);
    if (!isNaN(painScore) && painScore >= 0) {
      const interp = getPainInterpretation(painScore);
      charts.push({ key: 'pain', label: 'Current Pain Score', percentage: (painScore / 10) * 100, rawValue: `${painScore}/10`, color: interp.color, interpretation: interp.text, category: 'Pain Management' });
    }
  }
  const stopBangScore = extractScoreFromText(record.findings, /STOP-BANG\s*Score[:\s]*(\d+)/i);
  if (stopBangScore !== null) {
    const interp = getSTOPBANGInterpretation(stopBangScore);
    charts.push({ key: 'stopbang', label: 'STOP-BANG Score', percentage: (stopBangScore / 8) * 100, rawValue: `${stopBangScore}/8`, color: interp.color, interpretation: interp.text, category: 'Risk Assessment' });
  }
  const rcriScore = extractScoreFromText(record.findings, /RCRI\s*Score[:\s]*(\d+)/i);
  if (rcriScore !== null) {
    const interp = getRCRIInterpretation(rcriScore);
    charts.push({ key: 'rcri', label: 'RCRI (Cardiac Risk)', percentage: (rcriScore / 6) * 100, rawValue: `${rcriScore}/6`, color: interp.color, interpretation: interp.text, category: 'Risk Assessment' });
  }
  const apfelScore = extractScoreFromText(record.findings, /Apfel\s*Score[:\s]*(\d+)/i);
  if (apfelScore !== null) {
    const interp = getApfelInterpretation(apfelScore);
    charts.push({ key: 'apfel', label: 'Apfel Score (PONV Risk)', percentage: (apfelScore / 4) * 100, rawValue: `${apfelScore}/4`, color: interp.color, interpretation: interp.text, category: 'Risk Assessment' });
  }
  return charts;
};

// PDF Components
const PDFLegend = () => (
  <View style={chartStyles.legendContainer}>
    <View style={chartStyles.legendItem}><View style={[chartStyles.legendColor, { backgroundColor: '#898989' }]} /><Text style={chartStyles.legendText}>Low/Normal</Text></View>
    <View style={chartStyles.legendItem}><View style={[chartStyles.legendColor, { backgroundColor: '#7a7a7a' }]} /><Text style={chartStyles.legendText}>Mild</Text></View>
    <View style={chartStyles.legendItem}><View style={[chartStyles.legendColor, { backgroundColor: '#a7a7a7' }]} /><Text style={chartStyles.legendText}>Moderate</Text></View>
    <View style={chartStyles.legendItem}><View style={[chartStyles.legendColor, { backgroundColor: '#777777' }]} /><Text style={chartStyles.legendText}>High/Severe</Text></View>
  </View>
);

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

// Render object fields as subtitle + numbered items
const renderObjectFields = (obj) => {
  if (!obj || typeof obj !== 'object') return null;
  let n = 1;
  return Object.entries(obj).map(([key, value]) => {
    if (!hasValue(value)) return null;
    const label = formatKey(key);
    if (Array.isArray(value)) {
      return (
        <View key={key} style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>{label}</Text>
          {value.map((item, i) => (
            <Text key={i} style={styles.listItem}>{i + 1}. {typeof item === 'string' ? item : JSON.stringify(item)}</Text>
          ))}
        </View>
      );
    }
    if (typeof value === 'object' && value !== null) {
      return (
        <View key={key} style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>{label}</Text>
          {Object.entries(value).map(([nk, nv]) => {
            if (!hasValue(nv)) return null;
            if (nv && typeof nv === 'object' && !Array.isArray(nv)) {
              return <View key={nk}>{renderObjectFields({ [nk]: nv })}</View>;
            }
            return (
              <View key={nk} style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>{formatKey(nk)}</Text>
                <Text style={styles.fieldValue}>{toSafeString(nv)}</Text>
              </View>
            );
          })}
        </View>
      );
    }
    const sentences = splitBySentence(toSafeString(value));
    return (
      <View key={key} style={styles.fieldBlock}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {sentences.length > 1
          ? sentences.map((s, i) => <Text key={i} style={styles.fieldValue}>{s}</Text>)
          : <Text style={styles.fieldValue}>{toSafeString(value)}</Text>}
      </View>
    );
  });
};

// Render narrative field — a labeled sentence ("Label: value") becomes a bold label heading + value
// block (mirrors the JSX nested-subtitle + value card); unlabeled sentences render as a plain block.
const renderNarrativeField = (text) => {
  if (!hasValue(text)) return null;
  const sentences = splitBySentence(String(text));
  if (sentences.length === 0) return null;
  return sentences.map((s, i) => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      return (
        <View key={i} style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>{parsed.label}</Text>
          <Text style={styles.fieldValue}>{parsed.value}</Text>
        </View>
      );
    }
    return (
      <View key={i} style={styles.fieldBlock}>
        <Text style={styles.fieldValue}>{s}</Text>
      </View>
    );
  });
};

// Render a section with anti-orphan page-break handling (canonical Rule #74 + v4 fix — memories
// 6a2d6af6 / 6a3cda8c / 699004a9). The section title lives INSIDE the wrap unit, NEVER as a lone
// sibling (a sibling title gets a page break inserted after it → orphan). Small sections (<=8 rows)
// are one wrap={false} block so the title + rows always move together (and are small enough to never
// overprint). Large sections (>8 rows) flow across pages, with the title glued to the first row in a
// wrap={false} sub-View so it can never orphan while the remaining rows wrap.
const renderSection = (title, content) => {
  const rows = (Array.isArray(content) ? content : [content]).filter(Boolean);
  if (rows.length === 0) return null;
  if (rows.length <= 8) {
    return (
      <View style={styles.section} wrap={false}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {rows}
      </View>
    );
  }
  const [first, ...rest] = rows;
  return (
    <View style={styles.section} wrap>
      <View wrap={false}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {first}
      </View>
      {rest}
    </View>
  );
};

// Main Template
const AnesthesiologyAssessmentDocumentPDFTemplate = ({ document: data }) => {
  if (!data) return null;

  const normalizedData = Array.isArray(data) && data.length === 1 && (
    data[0]?.anesthesiology_assessment || data[0]?.data || data[0]?.documentData?.records
  ) ? data[0] : data;

  let recordsArray = [];
  if (normalizedData.anesthesiology_assessment) {
    recordsArray = Array.isArray(normalizedData.anesthesiology_assessment)
      ? normalizedData.anesthesiology_assessment
      : [normalizedData.anesthesiology_assessment];
  } else if (normalizedData.documentData?.records) {
    recordsArray = Array.isArray(normalizedData.documentData.records)
      ? normalizedData.documentData.records
      : [normalizedData.documentData.records];
  } else if (Array.isArray(normalizedData)) {
    recordsArray = normalizedData;
  } else if (normalizedData.data) {
    recordsArray = Array.isArray(normalizedData.data) ? normalizedData.data : [normalizedData.data];
  } else {
    recordsArray = [normalizedData];
  }

  if (recordsArray.length === 0) {
    return (
      <Document>
        <Page size="A4" style={styles.page}>
          <View style={styles.documentHeader}><Text style={styles.documentTitle}>Anesthesiology Assessment</Text></View>
          <Text style={styles.noData}>No data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      {recordsArray.map((record, idx) => {
        const chartData = prepareChartData(record);
        const hasChartData = chartData.length > 0;
        const riskCharts = chartData.filter(c => c.category === 'Risk Assessment');
        const airwayCharts = chartData.filter(c => c.category === 'Airway Assessment');
        const painCharts = chartData.filter(c => c.category === 'Pain Management');

        return (
          <Page key={idx} size="A4" style={styles.page} wrap>
            <View style={styles.documentHeader}>
              <Text style={styles.documentTitle}>Anesthesiology Assessment</Text>
            </View>

            {/* Record Header */}
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>
                {record.type ? String(record.type) : `Anesthesiology Assessment ${idx + 1}`}
              </Text>
              {record.asaClassification && <Text style={styles.recordSubtitle}>{String(record.asaClassification)}</Text>}
              <View style={styles.recordMeta}>
                {record.date && <Text style={styles.metaText}>Date: {formatDate(record.date)}</Text>}
                {record.provider && <Text style={styles.metaText}>Provider: {String(record.provider)}</Text>}
                {record.facility && <Text style={styles.metaText}>Facility: {String(record.facility)}</Text>}
                {record.status && <Text style={styles.metaText}>Status: {String(record.status)}</Text>}
              </View>
            </View>

            {/* Score Overview */}
            {hasChartData && (
              <View style={chartStyles.chartSection} wrap>
                <Text style={chartStyles.chartTitle}>Score Overview</Text>
                <PDFLegend />
                {riskCharts.length > 0 && (
                  <View wrap={false}>
                    <Text style={chartStyles.categoryHeader}>Risk Assessment</Text>
                    {riskCharts.map((chart) => <PDFBarChart key={chart.key} {...chart} />)}
                  </View>
                )}
                {airwayCharts.length > 0 && (
                  <View wrap={false}>
                    <Text style={chartStyles.categoryHeader}>Airway Assessment</Text>
                    {airwayCharts.map((chart) => <PDFBarChart key={chart.key} {...chart} />)}
                  </View>
                )}
                {painCharts.length > 0 && (
                  <View wrap={false}>
                    <Text style={chartStyles.categoryHeader}>Pain Management</Text>
                    {painCharts.map((chart) => <PDFBarChart key={chart.key} {...chart} />)}
                  </View>
                )}
              </View>
            )}

            {/* Airway Assessment Details */}
            {renderSection('Airway Assessment Details', renderObjectFields(record.airwayAssessment))}

            {/* Anesthesia Plan */}
            {renderSection('Anesthesia Plan', renderObjectFields(record.anesthesiaPlan))}

            {/* Pain Management Details */}
            {renderSection('Pain Management Details', renderObjectFields(record.painManagement))}

            {/* Findings */}
            {renderSection('Findings', renderNarrativeField(record.findings))}

            {/* Assessment */}
            {renderSection('Assessment', renderNarrativeField(record.assessment))}

            {/* Plan */}
            {renderSection('Plan', renderNarrativeField(record.plan))}

            {/* Results (dynamic-key object of test results) */}
            {renderSection('Results', renderObjectFields(record.results))}

            {/* Recommendations */}
            {renderSection('Recommendations', (() => {
              const groups = [];
              (record.recommendations || []).forEach((rec2) => {
                const rawDate = rec2 && typeof rec2 === 'object' ? rec2.date : '';
                const dateKey = rawDate ? formatDate(rawDate) : '';
                let group = groups.find(candidate => candidate.dateKey === dateKey);
                if (!group) { group = { dateKey, items: [] }; groups.push(group); }
                group.items.push(rec2);
              });
              return groups.map((group, groupIndex) => (
                <View key={`${group.dateKey}-${groupIndex}`} style={styles.fieldBlock} wrap={false}>
                  {group.dateKey && <Text style={styles.fieldLabel}>{group.dateKey}</Text>}
                  {group.items.map((rec2, itemIndex) => (
                    <Text key={itemIndex} style={styles.listItem}>{itemIndex + 1}. {String(rec2.recommendation || rec2)}</Text>
                  ))}
                </View>
              ));
            })())}

            {/* Notes */}
            {renderSection('Notes', renderNarrativeField(record.notes))}
          </Page>
        );
      })}
    </Document>
  );
};

export default AnesthesiologyAssessmentDocumentPDFTemplate;
