/**
 * AudiometryReportsDocumentPDFTemplate.jsx
 * PDFDownloadLink + pdfData memo pattern
 * ASCII separators only, Helvetica font
 * Audiogram bar chart + text sections
 */

import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 12, fontFamily: 'Helvetica', backgroundColor: '#ffffff', color: '#000000' },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', marginBottom: 24, textAlign: 'center', borderBottomWidth: 2, borderBottomColor: '#000000', paddingBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
  recordSection: { marginBottom: 24, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#cccccc' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginBottom: 8, backgroundColor: '#f0f0f0', padding: 8, borderWidth: 1, borderColor: '#000000' },
  recordMeta: { fontSize: 11, marginBottom: 4, color: '#333333', paddingLeft: 4 },
  fieldContainer: { marginBottom: 14 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', marginBottom: 6, borderBottomWidth: 1, borderBottomColor: '#000000', paddingBottom: 4 },
  fieldRow: { flexDirection: 'row', marginBottom: 6 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#404040', width: 180 },
  fieldValue: { fontSize: 12, color: '#404040', flex: 1 },
  listItem: { fontSize: 12, lineHeight: 1.5, paddingLeft: 12, marginBottom: 4 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#666666' },
  separator: { fontSize: 10, color: '#999999', marginBottom: 8, textAlign: 'center' },
  chartContainer: { marginBottom: 10, padding: 10, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 4, backgroundColor: '#f9fafb' },
  categoryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  categoryName: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#606060' },
  categoryDescription: { fontSize: 10, color: '#6b7280' },
  barChartRow: { marginBottom: 8, padding: 8, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 4 },
  barLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#606060', marginBottom: 4 },
  barContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
  barBackground: { flex: 1, height: 12, backgroundColor: '#e5e7eb', borderRadius: 3, marginRight: 8 },
  barFill: { height: 12, borderRadius: 3 },
  barValue: { fontSize: 11, fontFamily: 'Helvetica-Bold', minWidth: 60, textAlign: 'right' },
  barInterpretation: { fontSize: 9, fontFamily: 'Helvetica-Bold' },
});

const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
const splitBySentence = (t) => { if (!t || typeof t !== 'string') return []; return t.split(/(?<=[.!?])\s+|(?<=;)\s+/).filter(s => { const tr = s.trim(); return tr.length > 0 && tr.replace(/[.!?;,]+/g, '').trim().length > 0; }); };

const extractDbValue = (v) => { if (v === null || v === undefined) return null; if (typeof v === 'number') return v; const m = String(v).match(/(\d+(?:\.\d+)?)/); return m ? parseFloat(m[1]) : null; };
// Dynamic threshold keys: real data mixes "250Hz" and bare "250" and adds 3000/6000.
const getFrequencyKeys = (t) => { if (!t || typeof t !== 'object') return []; return Object.keys(t).sort((a, b) => { const na = parseFloat(a); const nb = parseFloat(b); if (isNaN(na) || isNaN(nb)) return String(a).localeCompare(String(b)); return na - nb; }); };
const formatFreqLabel = (k) => /hz$/i.test(String(k)) ? String(k) : `${k}Hz`;
const getThresholdColor = (db) => { if (db === null) return '#6b7280'; if (db <= 25) return '#898989'; if (db <= 40) return '#7a7a7a'; if (db <= 55) return '#a7a7a7'; if (db <= 70) return '#777777'; return '#5c5c5c'; };
const getThresholdInterp = (db) => { if (db === null) return '?'; if (db <= 25) return 'Normal'; if (db <= 40) return 'Mild'; if (db <= 55) return 'Moderate'; if (db <= 70) return 'Mod-Severe'; return 'Severe'; };

const AudiometryReportsDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.audiometry_reports) return Array.isArray(r.audiometry_reports) ? r.audiometry_reports : [r.audiometry_reports];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.audiometry_reports) return Array.isArray(dd.audiometry_reports) ? dd.audiometry_reports : [dd.audiometry_reports]; return [dd]; }
      return r;
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  const renderField = (label, value) => {
    if (!value || (Array.isArray(value) && value.length === 0) || String(value).trim() === '') return null;
    return <View style={styles.fieldRow}><Text style={styles.fieldLabel}>{label}:</Text><Text style={styles.fieldValue}>{String(value)}</Text></View>;
  };

  const renderSentenceField = (label, value) => {
    if (!value || String(value).trim() === '') return null;
    const sentences = splitBySentence(String(value));
    if (sentences.length <= 1) return renderField(label, value);
    return <View style={styles.fieldContainer}><Text style={styles.sectionTitle}>{label}</Text>{sentences.map((s, i) => <Text key={i} style={styles.listItem}>{i + 1}. {s}</Text>)}</View>;
  };

  const renderThresholds = (label, thresholds) => {
    if (!thresholds || typeof thresholds !== 'object') return null;
    const bars = getFrequencyKeys(thresholds).filter(f => thresholds[f] !== undefined && thresholds[f] !== null && String(thresholds[f]).trim() !== '').map(f => {
      const db = extractDbValue(thresholds[f]);
      return { freq: formatFreqLabel(f), raw: thresholds[f], db, color: getThresholdColor(db), interp: getThresholdInterp(db), pct: db !== null ? Math.max(0, 100 - (db / 120) * 100) : 0 };
    });
    if (bars.length === 0) return null;
    return (
      <View style={styles.chartContainer} wrap={bars.length > 8 ? undefined : false}>
        <View style={styles.categoryHeader}><Text style={styles.categoryName}>{label}</Text><Text style={styles.categoryDescription}>dB HL</Text></View>
        {bars.map(b => (
          <View key={b.freq} style={styles.barChartRow}>
            <Text style={styles.barLabel}>{b.freq}</Text>
            <View style={styles.barContainer}>
              <View style={styles.barBackground}><View style={[styles.barFill, { width: `${b.pct}%`, backgroundColor: b.color }]} /></View>
              <Text style={[styles.barValue, { color: b.color }]}>{b.db !== null ? `${b.db} dB` : String(b.raw)}</Text>
            </View>
            <Text style={[styles.barInterpretation, { color: b.color }]}>{b.interp}</Text>
          </View>
        ))}
      </View>
    );
  };

  if (!records || records.length === 0) {
    return <Document><Page size="A4" style={styles.page}><Text style={styles.documentTitle}>Audiometry Reports</Text><Text style={styles.emptyState}>No records available</Text></Page></Document>;
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.documentTitle}>Audiometry Reports</Text>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordSection}>
            <View wrap={false}>
              <Text style={styles.recordTitle}>{`Audiometry Report ${idx + 1}`}</Text>
              {record.date && <Text style={styles.recordMeta}>Date: {formatDate(record.date)}</Text>}
            </View>
            {idx > 0 && <Text style={styles.separator}>{'='.repeat(60)}</Text>}

            {(record.audiologist || record.facility) && (
              <View style={styles.fieldContainer}><Text style={styles.sectionTitle}>Record Information</Text>
                {renderField('Audiologist', record.audiologist)}{renderField('Facility', record.facility)}
              </View>
            )}
            {(record.testType || record.hearingLossType || record.hearingLossSeverity) && (
              <View style={styles.fieldContainer}><Text style={styles.sectionTitle}>Test Information</Text>
                {renderField('Test Type', record.testType)}{renderField('Hearing Loss Type', record.hearingLossType)}{renderField('Severity', record.hearingLossSeverity)}
              </View>
            )}
            {renderThresholds('Right Ear Thresholds', record.rightEarThresholds)}
            {renderThresholds('Left Ear Thresholds', record.leftEarThresholds)}
            {(record.speechReception || record.wordRecognition) && (
              <View style={styles.fieldContainer}><Text style={styles.sectionTitle}>Speech Results</Text>
                {renderField('Speech Reception', record.speechReception)}{renderField('Word Recognition', record.wordRecognition)}
              </View>
            )}
            {(record.tympanometry || record.acousticReflex) && (
              <View style={styles.fieldContainer}><Text style={styles.sectionTitle}>Middle Ear Function</Text>
                {renderField('Tympanometry', record.tympanometry)}{renderField('Acoustic Reflexes', record.acousticReflex)}
              </View>
            )}
            {renderSentenceField('Interpretation', record.interpretation)}
            {renderSentenceField('Recommendations', record.recommendations)}
            {renderSentenceField('Notes', record.notes)}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default AudiometryReportsDocumentPDFTemplate;
