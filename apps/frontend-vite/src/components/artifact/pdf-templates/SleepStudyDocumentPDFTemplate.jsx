/**
 * SleepStudyDocumentPDFTemplate.jsx
 * March 2026 -- Helvetica -- LETTER size -- sleep study
 * Collection: sleep_study
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#1f2937', textAlign: 'center', marginBottom: 4 },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#1f2937' },
  recordMeta: { fontSize: 11, color: '#6b7280', marginTop: 4 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8 },
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
    if (ch === '(' || ch === '"' || ch === "'") { depth++; current += ch; }
    else if (ch === ')' || (depth > 0 && (ch === '"' || ch === "'"))) { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) { const t = current.trim(); if (t) result.push(t); current = ''; }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

/* renderFieldRow: label + value inside fieldBox */
const renderFieldRow = (label, value, sectionTitle) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox} wrap={false}>
      {sectionTitle && <Text style={styles.sectionTitle}>{sectionTitle}</Text>}
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{safeString(fmtVal(value))}</Text>
    </View>
  );
};

/* renderSentenceField: parseLabel + comma-split with sequential counter */
const renderSentenceField = (label, text, counterRef, sectionTitle) => {
  if (!hasVal(text)) return null;
  if (typeof text !== 'string') {
    return renderFieldRow(label, text, sectionTitle);
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
      {sectionTitle && <Text style={styles.sectionTitle}>{sectionTitle}</Text>}
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

/* renderObjectField: renders object keys as labeled items */
const renderObjectField = (label, obj, counterRef) => {
  if (!obj || typeof obj !== 'object' || Object.keys(obj).length === 0) return null;
  const entries = Object.entries(obj).filter(([, v]) => v !== null && v !== undefined && v !== '');
  if (entries.length === 0) return null;

  return (
    <View style={styles.fieldBox} wrap={entries.length > 8 ? undefined : false}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {entries.map(([k, v], i) => (
        <Text key={i} style={styles.listItem}>{counterRef.n++}. {safeString(k)}: {safeString(v)}</Text>
      ))}
    </View>
  );
};

/* renderArrayField */
const renderArrayField = (label, items, counterRef, sectionTitle) => {
  if (!Array.isArray(items) || items.length === 0) return null;
  const safeItems = items.filter(Boolean);
  if (safeItems.length === 0) return null;

  return (
    <View style={styles.fieldBox} wrap={safeItems.length > 8 ? undefined : false}>
      {sectionTitle && <Text style={styles.sectionTitle}>{sectionTitle}</Text>}
      <Text style={styles.fieldLabel}>{label}</Text>
      {safeItems.map((item, i) => (
        <Text key={i} style={styles.listItem}>{counterRef.n++}. {safeString(item)}</Text>
      ))}
    </View>
  );
};

/* ======= COMPONENT ======= */
const SleepStudyDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.sleep_study) return Array.isArray(r.sleep_study) ? r.sleep_study : [r.sleep_study];
      if (r?.documentData) {
        const dd = r.documentData;
        if (Array.isArray(dd)) return dd;
        if (dd?.sleep_study) return Array.isArray(dd.sleep_study) ? dd.sleep_study : [dd.sleep_study];
        return [dd];
      }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Sleep Study</Text>
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
          <Text style={styles.documentTitle}>Sleep Study</Text>
        </View>

        {records.map((record, index) => {
          const ctr = { n: 1 };

          return (
            <View key={index} style={styles.recordContainer}>
              {index > 0 && <View style={styles.separator} />}

              {/* Record Header */}
              <View style={styles.recordHeader} wrap={false}>
                <Text style={styles.recordTitle}>{`Sleep Study ${index + 1}`}</Text>
                {record.date && <Text style={styles.recordMeta}>{formatDate(record.date)}</Text>}
                {record.provider && record.provider !== 'Not specified' && <Text style={styles.recordMeta}>Provider: {record.provider}</Text>}
                {record.facility && record.facility !== 'Not specified' && <Text style={styles.recordMeta}>Facility: {record.facility}</Text>}
              </View>

              {/* 1. Study Information */}
              {(hasVal(record.studyType) || hasVal(record.indicationForStudy)) && (
                <View style={styles.section}>
                  {renderSentenceField('Study Type', record.studyType, ctr, 'Study Information')}
                  {renderSentenceField('Indication for Study', record.indicationForStudy, ctr)}
                </View>
              )}

              {/* 2. Sleep Timing & Architecture */}
              {(hasVal(record.totalRecordingTime) || hasVal(record.totalSleepTime) || hasVal(record.sleepEfficiency) || hasVal(record.sleepLatency) || hasVal(record.remLatency)) && (
                <View style={styles.section}>
                  {renderFieldRow('Total Recording Time (min)', record.totalRecordingTime, 'Sleep Timing & Architecture')}
                  {renderFieldRow('Total Sleep Time (min)', record.totalSleepTime)}
                  {renderFieldRow('Sleep Efficiency (%)', record.sleepEfficiency)}
                  {renderFieldRow('Sleep Latency (min)', record.sleepLatency)}
                  {renderFieldRow('REM Latency (min)', record.remLatency)}
                </View>
              )}

              {/* 3. Respiratory & Movement Indices */}
              {(hasVal(record.apneaHypopneaIndex) || hasVal(record.oxygenDesaturationIndex) || hasVal(record.supineAHI) || hasVal(record.centralApneaIndex) || hasVal(record.obstructiveApneaIndex) || hasVal(record.snoringPercentage) || hasVal(record.arousalIndex) || hasVal(record.periodicLimbMovementIndex)) && (
                <View style={styles.section}>
                  {renderFieldRow('Apnea-Hypopnea Index (AHI)', record.apneaHypopneaIndex, 'Respiratory & Movement Indices')}
                  {renderFieldRow('Oxygen Desaturation Index (ODI)', record.oxygenDesaturationIndex)}
                  {renderFieldRow('Supine AHI', record.supineAHI)}
                  {renderFieldRow('Central Apnea Index', record.centralApneaIndex)}
                  {renderFieldRow('Obstructive Apnea Index', record.obstructiveApneaIndex)}
                  {renderFieldRow('Snoring Percentage (%)', record.snoringPercentage)}
                  {renderFieldRow('Arousal Index', record.arousalIndex)}
                  {renderFieldRow('Periodic Limb Movement Index (PLMI)', record.periodicLimbMovementIndex)}
                </View>
              )}

              {/* 4. Oxygenation */}
              {(hasVal(record.lowestOxygenSaturation) || hasVal(record.meanOxygenSaturation) || hasVal(record.timeBelow90Percent)) && (
                <View style={styles.section}>
                  {renderFieldRow('Lowest Oxygen Saturation (%)', record.lowestOxygenSaturation, 'Oxygenation')}
                  {renderFieldRow('Mean Oxygen Saturation (%)', record.meanOxygenSaturation)}
                  {renderFieldRow('Time Below 90% SpO2 (%)', record.timeBelow90Percent)}
                </View>
              )}

              {/* 5. CPAP & Positional Data */}
              {(hasVal(record.optimalCpapPressure) || hasVal(record.cpapSettingsTrialed) || hasVal(record.sleepStagePercentages) || hasVal(record.bodyPositionData)) && (
                <View style={styles.section}>
                  {renderFieldRow('Optimal CPAP Pressure (cmH2O)', record.optimalCpapPressure, 'CPAP & Positional Data')}
                  {renderObjectField('CPAP Settings Trialed', record.cpapSettingsTrialed, ctr)}
                  {renderObjectField('Sleep Stage Percentages', record.sleepStagePercentages, ctr)}
                  {renderObjectField('Body Position Data', record.bodyPositionData, ctr)}
                </View>
              )}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default SleepStudyDocumentPDFTemplate;
