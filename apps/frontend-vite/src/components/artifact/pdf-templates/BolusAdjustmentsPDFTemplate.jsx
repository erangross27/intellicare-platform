/**
 * BolusAdjustmentsPDFTemplate.jsx
 * Helvetica 20/14/12pt, numbered items, conditional wrap
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 12, fontFamily: 'Helvetica', backgroundColor: '#ffffff' },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', marginBottom: 14, textAlign: 'center', borderBottomWidth: 2, borderBottomColor: '#000000', paddingBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  recordSection: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#cccccc' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginBottom: 6, backgroundColor: '#f0f0f0', padding: 6, borderWidth: 1, borderColor: '#000000' },
  recordMeta: { fontSize: 11, marginBottom: 2, color: '#333333', paddingLeft: 4 },
  fieldContainer: { marginBottom: 10, marginTop: 4 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', marginBottom: 6, borderBottomWidth: 1, borderBottomColor: '#000000', paddingBottom: 4 },
  subSectionTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 3, marginTop: 6, paddingLeft: 4 },
  listItem: { fontSize: 12, lineHeight: 1.5, paddingLeft: 12, marginBottom: 3 },
  nestedGroup: { paddingLeft: 10, borderLeftWidth: 1, borderLeftColor: '#cccccc', marginBottom: 2 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#666666' },
});

const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'string') return v.trim() !== ''; return true; };
const splitBySentence = (text) => { if (!text) return []; return text.split(/\.\s+/).map(s => s.trim()).filter(s => s.length > 0 && s.replace(/[.!?;,]+/g, '').trim().length > 0); };
const humanizeKey = (key) => { if (key === null || key === undefined || key === '') return ''; const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2'); return s.charAt(0).toUpperCase() + s.slice(1); };
const isScalar = (v) => v === null || typeof v !== 'object';
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
const isEmptyDeep = (v) => { if (v === null || v === undefined) return true; if (typeof v === 'boolean') return false; if (typeof v === 'number') return !Number.isFinite(v); if (typeof v === 'string') return v.trim() === ''; if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0; if (typeof v === 'object') return Object.values(v).every(isEmptyDeep); return false; };
const renderObjectTree = (value, depth) => {
  if (isEmptyDeep(value) || isScalar(value)) return null;
  return Object.entries(value).filter(([, v]) => !isEmptyDeep(v)).map(([k, v]) => (
    isScalar(v)
      ? <View key={k} wrap={false}><Text style={styles.subSectionTitle}>{humanizeKey(k)}</Text><Text style={styles.listItem}>{fmtScalar(v)}</Text></View>
      : <View key={k}><Text style={styles.subSectionTitle}>{humanizeKey(k)}</Text><View style={styles.nestedGroup}>{renderObjectTree(v, depth + 1)}</View></View>
  ));
};

const BolusAdjustmentsPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => { if (r?.bolus_adjustments) return Array.isArray(r.bolus_adjustments) ? r.bolus_adjustments : [r.bolus_adjustments]; if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.bolus_adjustments) return Array.isArray(dd.bolus_adjustments) ? dd.bolus_adjustments : [dd.bolus_adjustments]; return [dd]; } return r; });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) return <Document><Page size="A4" style={styles.page}><Text style={styles.documentTitle}>Bolus Adjustments</Text><Text style={styles.emptyState}>No records available</Text></Page></Document>;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.documentTitle}>Bolus Adjustments</Text>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordSection}>
            <View wrap={false}><Text style={styles.recordTitle}>{`Bolus Adjustment ${idx + 1}`}</Text>{record.date && <Text style={styles.recordMeta}>{formatDate(record.date)}</Text>}</View>

            {(hasVal(record.mealTime) || hasVal(record.oldRatio) || hasVal(record.newRatio) || hasVal(record.reason)) && (<View style={styles.fieldContainer} wrap={false}><Text style={styles.sectionTitle}>Bolus Adjustment</Text>{hasVal(record.mealTime) && <><Text style={styles.subSectionTitle}>Meal Time</Text><Text style={styles.listItem}>{record.mealTime}</Text></>}{hasVal(record.oldRatio) && <><Text style={styles.subSectionTitle}>Old Ratio</Text><Text style={styles.listItem}>{record.oldRatio}</Text></>}{hasVal(record.newRatio) && <><Text style={styles.subSectionTitle}>New Ratio</Text><Text style={styles.listItem}>{record.newRatio}</Text></>}{hasVal(record.reason) && <><Text style={styles.subSectionTitle}>Reason for Change</Text><Text style={styles.listItem}>{record.reason}</Text></>}</View>)}

            {(hasVal(record.findings) || hasVal(record.assessment)) && (<View style={styles.fieldContainer} wrap={false}><Text style={styles.sectionTitle}>Clinical Assessment</Text>{hasVal(record.findings) && <><Text style={styles.subSectionTitle}>Findings</Text><Text style={styles.listItem}>{record.findings}</Text></>}{hasVal(record.assessment) && <><Text style={styles.subSectionTitle}>Assessment</Text><Text style={styles.listItem}>{record.assessment}</Text></>}</View>)}

            {hasVal(record.plan) && (() => { const items = splitBySentence(record.plan); return (<View style={styles.fieldContainer} wrap={items.length > 8 ? undefined : false}><Text style={styles.sectionTitle}>Plan</Text>{items.map((s, i) => <Text key={i} style={styles.listItem}>{i + 1}. {s.replace(/\.$/, '')}</Text>)}</View>); })()}

            {!isEmptyDeep(record.results) && !isScalar(record.results) && (() => { const entries = Object.entries(record.results).filter(([, v]) => !isEmptyDeep(v)); if (entries.length === 0) return null; return (<View style={styles.fieldContainer} wrap={entries.length > 8 ? undefined : false}><Text style={styles.sectionTitle}>Results</Text>{entries.map(([k, v]) => (isScalar(v) ? <View key={k} wrap={false}><Text style={styles.subSectionTitle}>{humanizeKey(k)}</Text><Text style={styles.listItem}>{fmtScalar(v)}</Text></View> : <View key={k}><Text style={styles.subSectionTitle}>{humanizeKey(k)}</Text><View style={styles.nestedGroup}>{renderObjectTree(v, 1)}</View></View>))}</View>); })()}

            {Array.isArray(record.recommendations) && record.recommendations.filter(r => !isEmptyDeep(r)).length > 0 && (() => { const recs = record.recommendations.filter(r => !isEmptyDeep(r)); return (<View style={styles.fieldContainer} wrap={recs.length > 8 ? undefined : false}><Text style={styles.sectionTitle}>Recommendations</Text>{recs.map((rec, i) => <Text key={i} style={styles.listItem}>{i + 1}. {(rec?.recommendation || '').trim()}{rec?.date ? ` (${rec.date})` : ''}</Text>)}</View>); })()}

            {(hasVal(record.provider) || hasVal(record.facility) || hasVal(record.status)) && (<View style={styles.fieldContainer} wrap={false}><Text style={styles.sectionTitle}>Provider Information</Text>{hasVal(record.provider) && <><Text style={styles.subSectionTitle}>Provider</Text><Text style={styles.listItem}>{record.provider}</Text></>}{hasVal(record.facility) && <><Text style={styles.subSectionTitle}>Facility</Text><Text style={styles.listItem}>{record.facility}</Text></>}{hasVal(record.status) && <><Text style={styles.subSectionTitle}>Status</Text><Text style={styles.listItem}>{record.status}</Text></>}</View>)}

            {hasVal(record.notes) && (<View style={styles.fieldContainer} wrap={false}><Text style={styles.sectionTitle}>Notes</Text>{splitBySentence(record.notes).map((s, i) => <Text key={i} style={styles.listItem}>{i + 1}. {s.replace(/\.$/, '')}</Text>)}</View>)}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default BolusAdjustmentsPDFTemplate;
