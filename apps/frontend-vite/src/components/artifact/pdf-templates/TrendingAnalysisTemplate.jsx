/**
 * TrendingAnalysisTemplate.jsx (PDF)
 * March 2026 — Helvetica — LETTER size — trending analysis
 * Collection: trending_analysis
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#1f2937', textAlign: 'center', marginBottom: 4 },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordDateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  recordDate: { fontSize: 11, color: '#6b7280', fontFamily: 'Helvetica' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#1f2937' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#333333', marginBottom: 2 },
  fieldValue: { fontSize: 11, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 11, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#d1d5db', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 12, color: '#6b7280', textAlign: 'center', marginTop: 40 },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#e5e7eb', borderBottomStyle: 'solid' },
  itemName: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#1f2937' },
  badge: { fontSize: 9, fontFamily: 'Helvetica-Bold', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  badgeRow: { flexDirection: 'row', gap: 4 },
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

/* renderFieldRow */
const renderFieldRow = (label, value) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{safeString(fmtVal(value))}</Text>
    </View>
  );
};

/* renderSentenceSection: parseLabel + comma-split */
const renderSentenceSection = (label, text) => {
  if (!hasVal(text)) return null;
  const sentences = splitBySentence(fmtVal(text));
  if (sentences.length === 0) return renderFieldRow(label, text);

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

/* humanizeKey for object leaves */
const humanizeKey = (k) => String(k).replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim();

/* renderArrayRow: bulleted list for array fields (recommendations) */
const renderArrayRow = (label, value) => {
  if (!hasVal(value)) return null;
  const items = Array.isArray(value) ? value.filter(hasVal) : [value];
  if (items.length === 0) return null;
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {items.map((it, i) => (
        <Text key={i} style={styles.listItem}>{i + 1}. {safeString(fmtVal(it))}</Text>
      ))}
    </View>
  );
};

/* renderObjectRows: recursive object leaves (results) */
const renderObjectRows = (label, value) => {
  if (!hasVal(value) || typeof value !== 'object' || Array.isArray(value)) return null;
  const entries = Object.entries(value).filter(([, v]) => hasVal(v) && !(typeof v === 'number' && v === 0));
  if (entries.length === 0) return null;
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {entries.map(([k, v], i) => {
        if (v !== null && typeof v === 'object' && !Array.isArray(v) && !v.$date) {
          return (
            <View key={i} style={{ paddingLeft: 8 }}>
              <Text style={styles.nestedSubtitle}>{humanizeKey(k)}</Text>
              {Object.entries(v).filter(([, vv]) => hasVal(vv)).map(([kk, vv], j) => (
                <Text key={j} style={styles.listItem}>{humanizeKey(kk)}: {safeString(fmtVal(vv))}</Text>
              ))}
            </View>
          );
        }
        return <Text key={i} style={styles.listItem}>{humanizeKey(k)}: {safeString(fmtVal(v))}</Text>;
      })}
    </View>
  );
};

/* Sort by priority */
const sortByPriority = (items) => {
  if (!items || !Array.isArray(items)) return [];
  const priorityOrder = { urgent: 1, critical: 1, immediate: 1, high: 2, important: 2, moderate: 3, medium: 3, monitor: 3, watch: 3, routine: 4, normal: 4, low: 5 };
  return [...items].sort((a, b) => {
    const ap = a.priority ? (priorityOrder[a.priority.toLowerCase()] || 999) : 999;
    const bp = b.priority ? (priorityOrder[b.priority.toLowerCase()] || 999) : 999;
    if (ap !== bp) return ap - bp;
    const aName = (a.test || a.parameter || '').toLowerCase();
    const bName = (b.test || b.parameter || '').toLowerCase();
    return aName.localeCompare(bName);
  });
};

/* ======= COMPONENT ======= */
const TrendingAnalysisPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.trending_analysis) return Array.isArray(r.trending_analysis) ? r.trending_analysis : [r.trending_analysis];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.trending_analysis) return Array.isArray(dd.trending_analysis) ? dd.trending_analysis : [dd.trending_analysis]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Trending Analysis</Text>
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
          <Text style={styles.documentTitle}>Trending Analysis</Text>
        </View>

        {records.map((record, index) => (
          <View key={index} style={styles.recordContainer}>
            {index > 0 && <View style={styles.separator} />}

            {/* Record Header */}
            <View style={styles.recordHeader} wrap={false}>
              <View style={styles.recordDateRow}>
                {(record.documentDate || record.date) && (
                  <Text style={styles.recordDate}>{formatDate(record.documentDate || record.date)}</Text>
                )}
              </View>
              <Text style={styles.recordTitle}>
                {record.patientName || `Trending Analysis ${index + 1}`}
              </Text>
            </View>

            {/* Document Details */}
            {(hasVal(record.date) || hasVal(record.type) || hasVal(record.provider) || hasVal(record.facility) || hasVal(record.status)) && (
              <View style={styles.section} wrap={[record.date, record.type, record.provider, record.facility, record.status].filter(hasVal).length > 8 ? undefined : false}>
                <Text style={styles.sectionTitle}>Document Details</Text>
                {renderFieldRow('Date', formatDate(record.date))}
                {renderFieldRow('Type', record.type)}
                {renderFieldRow('Provider', record.provider)}
                {renderFieldRow('Facility', record.facility)}
                {renderFieldRow('Status', record.status)}
              </View>
            )}

            {/* Lab Trends */}
            {record.labTrends && Array.isArray(record.labTrends) && record.labTrends.length > 0 && (
              <View style={styles.section} wrap={record.labTrends.length > 8 ? undefined : false}>
                <Text style={styles.sectionTitle}>Laboratory Trends</Text>
                {sortByPriority(record.labTrends).filter(lab => lab != null).map((lab, labIdx) => (
                  <View key={labIdx} style={styles.fieldBox} wrap={false}>
                    <View style={styles.itemHeader}>
                      <Text style={styles.itemName}>{labIdx + 1}. {lab.test || 'Test'}</Text>
                      <View style={styles.badgeRow}>
                        {lab.trend && <Text style={[styles.badge, { color: '#000000' }]}>[{lab.trend}]</Text>}
                        {lab.priority && <Text style={[styles.badge, { color: '#5c5c5c' }]}>[{lab.priority}]</Text>}
                      </View>
                    </View>
                    {renderSentenceSection('Latest Value', lab.latestValue)}
                    {renderSentenceSection('Target Value', lab.targetValue)}
                    {renderSentenceSection('Interpretation', lab.interpretation)}
                    {renderSentenceSection('Action Needed', lab.actionNeeded)}
                    {renderFieldRow('Reassessment Timeline', lab.reassessmentTimeline)}
                  </View>
                ))}
              </View>
            )}

            {/* Vital Signs Trends */}
            {record.vitalSignsTrends && Array.isArray(record.vitalSignsTrends) && record.vitalSignsTrends.length > 0 && (
              <View style={styles.section} wrap={record.vitalSignsTrends.length > 8 ? undefined : false}>
                <Text style={styles.sectionTitle}>Vital Signs Trends</Text>
                {sortByPriority(record.vitalSignsTrends).filter(vital => vital != null).map((vital, vitalIdx) => (
                  <View key={vitalIdx} style={styles.fieldBox} wrap={false}>
                    <View style={styles.itemHeader}>
                      <Text style={styles.itemName}>{vitalIdx + 1}. {vital.parameter || 'Parameter'}</Text>
                      <View style={styles.badgeRow}>
                        {vital.trend && <Text style={[styles.badge, { color: '#000000' }]}>[{vital.trend}]</Text>}
                        {vital.priority && <Text style={[styles.badge, { color: '#5c5c5c' }]}>[{vital.priority}]</Text>}
                      </View>
                    </View>
                    {renderSentenceSection('Latest Value', vital.latestValue)}
                    {renderFieldRow('Monitoring Threshold', vital.monitoringThreshold)}
                    {renderSentenceSection('Interpretation', vital.interpretation)}
                    {renderSentenceSection('Clinical Significance', vital.clinicalSignificance)}
                    {renderSentenceSection('Action Needed', vital.actionNeeded)}
                    {renderFieldRow('Reassessment Timeline', vital.reassessmentTimeline)}
                  </View>
                ))}
              </View>
            )}

            {/* Disease Trajectory */}
            {record.diseaseProgression && (record.diseaseProgression.trajectory || record.diseaseProgression.timeline) && (
              <View style={styles.section} wrap={[record.diseaseProgression.trajectory, record.diseaseProgression.timeline].filter(hasVal).length > 8 ? undefined : false}>
                <Text style={styles.sectionTitle}>Disease Trajectory</Text>
                {renderSentenceSection('Overall Trajectory', record.diseaseProgression.trajectory)}
                {renderSentenceSection('Timeline', record.diseaseProgression.timeline)}
              </View>
            )}

            {/* Key Events */}
            {record.diseaseProgression?.keyEvents && Array.isArray(record.diseaseProgression.keyEvents) && record.diseaseProgression.keyEvents.length > 0 && (
              <View style={styles.section} wrap={record.diseaseProgression.keyEvents.length > 8 ? undefined : false}>
                <Text style={styles.sectionTitle}>Key Events</Text>
                {[...record.diseaseProgression.keyEvents]
                  .sort((a, b) => {
                    const dateA = new Date(a.date);
                    const dateB = new Date(b.date);
                    if (isNaN(dateA.getTime())) return 1;
                    if (isNaN(dateB.getTime())) return -1;
                    return dateA - dateB;
                  })
                  .filter(event => event != null)
                  .map((event, evIdx) => (
                    <View key={evIdx} style={styles.fieldBox} wrap={false}>
                      {renderFieldRow('Date', formatDate(event.date))}
                      {renderSentenceSection('Event', event.event)}
                      {renderSentenceSection('Impact', event.impact)}
                    </View>
                  ))}
              </View>
            )}

            {/* Prognosis */}
            {record.diseaseProgression?.prognosis && (
              <View style={styles.section} wrap={splitBySentence(fmtVal(record.diseaseProgression.prognosis)).length > 8 ? undefined : false}>
                <Text style={styles.sectionTitle}>Prognosis</Text>
                {renderSentenceSection('Prognosis', record.diseaseProgression.prognosis)}
              </View>
            )}

            {/* Clinical Summary */}
            {(hasVal(record.findings) || hasVal(record.assessment) || hasVal(record.plan) || hasVal(record.recommendations) || hasVal(record.results) || hasVal(record.notes)) && (
              <View style={styles.section} wrap={[record.findings, record.assessment, record.plan, record.recommendations, record.results, record.notes].filter(hasVal).length > 8 ? undefined : false}>
                <Text style={styles.sectionTitle}>Clinical Summary</Text>
                {renderSentenceSection('Findings', record.findings)}
                {renderSentenceSection('Assessment', record.assessment)}
                {renderSentenceSection('Plan', record.plan)}
                {renderArrayRow('Recommendations', record.recommendations)}
                {renderObjectRows('Results', record.results)}
                {renderSentenceSection('Notes', record.notes)}
              </View>
            )}

            {/* Summary */}
            {(record.labTrends || record.vitalSignsTrends || record.diseaseProgression?.keyEvents) && (
              <View style={styles.section} wrap={[record.labTrends, record.vitalSignsTrends, record.diseaseProgression?.keyEvents].filter(Boolean).length > 8 ? undefined : false}>
                <Text style={styles.sectionTitle}>Summary</Text>
                {record.labTrends && renderFieldRow('Lab Parameters Tracked', record.labTrends.length.toString())}
                {record.vitalSignsTrends && renderFieldRow('Vital Signs Monitored', record.vitalSignsTrends.length.toString())}
                {record.diseaseProgression?.keyEvents && renderFieldRow('Key Events', record.diseaseProgression.keyEvents.length.toString())}
              </View>
            )}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default TrendingAnalysisPDFTemplate;
