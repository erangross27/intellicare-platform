/**
 * WellChildExaminationsDocumentPDFTemplate.jsx
 * March 2026 -- Helvetica -- LETTER size -- well child examinations
 * Collection: well_child_examinations
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
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#d1d5db', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 12, color: '#6b7280', textAlign: 'center', marginTop: 40 },
  chartSection: { marginBottom: 16, padding: 12, backgroundColor: '#ffffff', borderRadius: 4, border: '1px solid #e5e7eb' },
  chartLegend: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid #e5e7eb' },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginRight: 16, marginBottom: 4 },
  legendColor: { width: 10, height: 10, borderRadius: 2, marginRight: 4 },
  legendText: { fontSize: 9, color: '#000000' },
  barRow: { marginBottom: 12 },
  barLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 4 },
  barContainer: { flexDirection: 'row', alignItems: 'center' },
  barBackground: { flex: 1, height: 16, backgroundColor: '#e5e5e5', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  barValue: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#000000', marginLeft: 8, width: 45, textAlign: 'right' },
  barMeasurement: { fontSize: 9, color: '#000000', marginTop: 2, paddingLeft: 4 },
});

/* ======= UTILS ======= */
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try { const d = new Date(dateStr.$date || dateStr); if (isNaN(d.getTime())) return String(dateStr); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateStr); }
};

const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'string' ? val : String(val);
  str = str.replace(/[\u03BC\u00B5]m/g, 'um');
  str = str.replace(/\u00B0/g, ' deg');
  str = str.replace(/\u00B1/g, '+/-');
  str = str.replace(/\u2265/g, '>=');
  str = str.replace(/\u2264/g, '<=');
  str = str.replace(/\u2192/g, '->');
  return str;
};

const hasVal = (v) => {
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'boolean') return true;
  if (typeof v === 'object') return Object.keys(v).length > 0;
  return true;
};

const extractPercentile = (percentileStr) => {
  if (!percentileStr || typeof percentileStr !== 'string') return null;
  const match = percentileStr.match(/(\d+)(?:th|st|nd|rd)/i);
  return match ? parseInt(match[1], 10) : null;
};

const getPercentileColor = (percentile) => {
  if (percentile === null) return '#6b7280';
  if (percentile >= 75) return '#898989';
  if (percentile >= 50) return '#7a7a7a';
  if (percentile >= 25) return '#a7a7a7';
  return '#777777';
};

const parseAnticipatory = (text) => {
  if (!text || typeof text !== 'string') return { topic: null, content: text };
  const colonIdx = text.indexOf(':');
  if (colonIdx > 0 && colonIdx <= 25) {
    return { topic: text.substring(0, colonIdx).trim(), content: text.substring(colonIdx + 1).trim() };
  }
  return { topic: null, content: text };
};

/* ======= LEGEND ======= */
const Legend = () => (
  <View style={styles.chartLegend}>
    <View style={styles.legendItem}><View style={[styles.legendColor, { backgroundColor: '#898989' }]} /><Text style={styles.legendText}>75th+ percentile</Text></View>
    <View style={styles.legendItem}><View style={[styles.legendColor, { backgroundColor: '#7a7a7a' }]} /><Text style={styles.legendText}>50-74th percentile</Text></View>
    <View style={styles.legendItem}><View style={[styles.legendColor, { backgroundColor: '#a7a7a7' }]} /><Text style={styles.legendText}>25-49th percentile</Text></View>
    <View style={styles.legendItem}><View style={[styles.legendColor, { backgroundColor: '#777777' }]} /><Text style={styles.legendText}>Below 25th</Text></View>
  </View>
);

/* ======= BAR CHART ROW ======= */
const BarChartRow = ({ label, percentile, value }) => {
  const percentage = percentile !== null ? Math.min(100, Math.max(0, percentile)) : 0;
  const color = getPercentileColor(percentile);
  return (
    <View style={styles.barRow} wrap={false}>
      <Text style={styles.barLabel}>{safeString(label)}</Text>
      <View style={styles.barContainer}>
        <View style={styles.barBackground}>
          {percentile !== null && <View style={[styles.barFill, { width: `${percentage}%`, backgroundColor: color }]} />}
        </View>
        <Text style={[styles.barValue, { color }]}>{percentile !== null ? `${percentile}th` : 'N/A'}</Text>
      </View>
      {value && <Text style={styles.barMeasurement}>{safeString(value)}</Text>}
    </View>
  );
};

/* ======= COMPONENT ======= */
const WellChildExaminationsDocumentPDFTemplate = ({ document: docProp }) => {
  const records = (() => {
    if (!docProp) return [];
    if (Array.isArray(docProp)) return docProp.flatMap(item => {
      if (item.well_child_examinations) return item.well_child_examinations;
      if (item.records) return item.records;
      return item;
    });
    if (docProp.data) {
      if (Array.isArray(docProp.data)) return docProp.data.flatMap(item => {
        if (item.well_child_examinations) return item.well_child_examinations;
        if (item.records) return item.records;
        return item;
      });
      return [docProp.data];
    }
    return [docProp];
  })();

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}><Text style={styles.documentTitle}>Well Child Examinations</Text></View>
          <Text style={styles.noDataText}>No examination data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Well Child Examinations</Text></View>

        {records.map((record, idx) => {
          const heightPercentile = extractPercentile(record.height?.percentile);
          const weightPercentile = extractPercentile(record.weight?.percentile);
          const bmiPercentile = extractPercentile(record.bmi?.percentile);
          const hasGrowthData = heightPercentile !== null || weightPercentile !== null || bmiPercentile !== null;

          return (
            <View key={idx} style={styles.recordContainer}>
              <View style={styles.recordHeader}>
                <View style={styles.recordDateRow}>
                  <Text style={styles.recordTitle}>Well Child Examination {idx + 1}</Text>
                  {record.visitDate && <Text style={styles.recordDate}>{formatDate(record.visitDate)}</Text>}
                </View>
              </View>

              {/* Visit Information */}
              {(hasVal(record.age) || hasVal(record.nextWellVisit)) && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Visit Information</Text>
                  {hasVal(record.age) && <View style={styles.fieldBox}><Text style={styles.fieldLabel}>Age</Text><Text style={styles.fieldValue}>{safeString(record.age)}</Text></View>}
                  {hasVal(record.nextWellVisit) && <View style={styles.fieldBox}><Text style={styles.fieldLabel}>Next Well Visit</Text><Text style={styles.fieldValue}>{safeString(record.nextWellVisit)}</Text></View>}
                </View>
              )}

              {/* Growth Parameters */}
              {hasGrowthData && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Growth Parameters</Text>
                  <View style={styles.chartSection}>
                    <Legend />
                    {heightPercentile !== null && <BarChartRow label="Height" percentile={heightPercentile} value={record.height?.value} />}
                    {weightPercentile !== null && <BarChartRow label="Weight" percentile={weightPercentile} value={record.weight?.value} />}
                    {bmiPercentile !== null && <BarChartRow label="BMI" percentile={bmiPercentile} value={`${record.bmi?.value}${record.bmi?.category ? ` (${record.bmi.category})` : ''}`} />}
                  </View>
                </View>
              )}

              {/* Developmental Screening */}
              {hasVal(record.developmentalScreening) && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Developmental Screening</Text>
                  {hasVal(record.developmentalScreening?.result) && <View style={styles.fieldBox}><Text style={styles.fieldLabel}>Result</Text><Text style={styles.fieldValue}>{safeString(record.developmentalScreening.result)}</Text></View>}
                  {hasVal(record.developmentalScreening?.notes) && <View style={styles.fieldBox}><Text style={styles.fieldLabel}>Notes</Text><Text style={styles.fieldValue}>{safeString(record.developmentalScreening.notes)}</Text></View>}
                </View>
              )}

              {/* Screenings */}
              {(hasVal(record.visionScreening) || hasVal(record.hearingScreening) || hasVal(record.leadScreening)) && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Screenings</Text>
                  {hasVal(record.visionScreening) && (
                    <View style={styles.fieldBox}>
                      <Text style={styles.fieldLabel}>Vision</Text>
                      <Text style={styles.fieldValue}>{safeString(record.visionScreening.result)}{record.visionScreening.acuity ? ` - ${safeString(record.visionScreening.acuity)}` : ''}</Text>
                    </View>
                  )}
                  {hasVal(record.hearingScreening) && <View style={styles.fieldBox}><Text style={styles.fieldLabel}>Hearing</Text><Text style={styles.fieldValue}>{safeString(record.hearingScreening.result)}</Text></View>}
                  {hasVal(record.leadScreening) && <View style={styles.fieldBox}><Text style={styles.fieldLabel}>Lead</Text><Text style={styles.fieldValue}>{safeString(record.leadScreening.result)}</Text></View>}
                </View>
              )}

              {/* Immunizations Given */}
              {record.immunizationsGiven?.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Immunizations Given</Text>
                  {record.immunizationsGiven.map((imm, immIdx) => (
                    <Text key={immIdx} style={styles.listItem} wrap={false}>{immIdx + 1}. {safeString(imm)}</Text>
                  ))}
                </View>
              )}

              {/* Anticipatory Guidance */}
              {record.anticipatoryGuidance?.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Anticipatory Guidance</Text>
                  {record.anticipatoryGuidance.map((item, gIdx) => {
                    const parsed = parseAnticipatory(item);
                    return (
                      <View key={gIdx} style={styles.fieldBox} wrap={false}>
                        {parsed.topic && <Text style={styles.fieldLabel}>{safeString(parsed.topic)}</Text>}
                        <Text style={styles.fieldValue}>{gIdx + 1}. {safeString(parsed.content)}</Text>
                      </View>
                    );
                  })}
                </View>
              )}

              {idx < records.length - 1 && <View style={styles.separator} />}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default WellChildExaminationsDocumentPDFTemplate;
