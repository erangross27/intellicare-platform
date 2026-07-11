/**
 * BasalRateAdjustmentsPDFTemplate.jsx
 * PDFDownloadLink + pdfData memo pattern, ASCII separators, Helvetica
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 12, fontFamily: 'Helvetica', backgroundColor: '#ffffff' },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', marginBottom: 24, textAlign: 'center', borderBottomWidth: 2, borderBottomColor: '#000000', paddingBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
  recordSection: { marginBottom: 24, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#cccccc' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginBottom: 8, backgroundColor: '#f0f0f0', padding: 8, borderWidth: 1, borderColor: '#000000' },
  recordMeta: { fontSize: 11, marginBottom: 4, color: '#333333', paddingLeft: 4 },
  fieldContainer: { marginBottom: 14 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', marginBottom: 6, borderBottomWidth: 1, borderBottomColor: '#000000', paddingBottom: 4 },
  fieldBlock: { marginBottom: 6 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#404040', marginBottom: 1 },
  fieldValue: { fontSize: 12, color: '#404040', paddingLeft: 12, lineHeight: 1.4 },
  listItem: { fontSize: 12, lineHeight: 1.5, paddingLeft: 12, marginBottom: 4 },
  subLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 1 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#666666' },
});

const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
const splitBySentence = (t) => { if (!t || typeof t !== 'string') return []; return t.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|Prof|Rev|Sr|Jr|St|Gen|Col|Sgt|Lt|Capt|vs|etc)\.)(?<=[.!?])\s+/).filter(s => { const tr = s.trim(); return tr.length > 0 && tr.replace(/[.!?;,]+/g, '').trim().length > 0; }); };
const parseLabel = (s) => { if (!s || typeof s !== 'string') return { isLabeled: false, label: '', value: s || '' }; const m = s.match(/^([^:]{1,80}):\s+(\S.*)$/s); if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() }; return { isLabeled: false, label: '', value: s }; };
// Built-in Helvetica lacks → ≥ ≤ µ etc.; a missing glyph renders as garbage AND eats the next space — ASCII-map for PDF.
const pdfSafe = (s) => String(s == null ? '' : s).replace(/→/g, '->').replace(/←/g, '<-').replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/µ/g, 'u').replace(/±/g, '+/-').replace(/×/g, 'x').replace(/÷/g, '/').replace(/°/g, ' deg').replace(/—/g, '-').replace(/–/g, '-');

const BasalRateAdjustmentsPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => { if (r?.basal_rate_adjustments) return Array.isArray(r.basal_rate_adjustments) ? r.basal_rate_adjustments : [r.basal_rate_adjustments]; if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.basal_rate_adjustments) return Array.isArray(dd.basal_rate_adjustments) ? dd.basal_rate_adjustments : [dd.basal_rate_adjustments]; return [dd]; } return r; });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  // Stacked (bold label ABOVE value, NO colon) — never side-by-side "Label: value".
  const renderField = (label, value) => { if (!value || String(value).trim() === '') return null; return <View style={styles.fieldBlock} wrap={false}><Text style={styles.fieldLabel}>{label}</Text><Text style={styles.fieldValue}>{pdfSafe(value)}</Text></View>; };
  // Notes/Follow-Up: a labeled sentence "X: y" → bold sub-label + value (nested, no side-by-side); plain
  // sentences → numbered; mirrors the JSX nested-subtitle.
  const renderSentenceField = (label, value) => {
    if (!value || String(value).trim() === '') return null;
    const ss = splitBySentence(String(value)); if (ss.length === 0) return null;
    if (ss.length === 1) { const p = parseLabel(ss[0]); if (!p.isLabeled) return renderField(label, value); return <View style={styles.fieldContainer} wrap={false}><Text style={styles.sectionTitle}>{label}</Text><Text style={styles.subLabel}>{pdfSafe(p.label)}</Text><Text style={styles.listItem}>{pdfSafe(p.value)}</Text></View>; }
    const hasLabels = ss.some(s => parseLabel(s).isLabeled);
    return <View style={styles.fieldContainer} wrap={ss.length > 8}><Text style={styles.sectionTitle}>{label}</Text>{ss.map((s, i) => { const p = parseLabel(s); if (p.isLabeled) return <View key={i} wrap={false}><Text style={styles.subLabel}>{pdfSafe(p.label)}</Text><Text style={styles.listItem}>{pdfSafe(p.value)}</Text></View>; return <Text key={i} style={styles.listItem}>{hasLabels ? '' : `${i + 1}. `}{pdfSafe(s)}</Text>; })}</View>;
  };

  if (!records || records.length === 0) return <Document><Page size="A4" style={styles.page}><Text style={styles.documentTitle}>Basal Rate Adjustments</Text><Text style={styles.emptyState}>No records available</Text></Page></Document>;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.documentTitle}>Basal Rate Adjustments</Text>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordSection}>
            <View wrap={false}><Text style={styles.recordTitle}>{`Basal Rate Adjustment ${idx + 1}`}</Text>{record.date && <Text style={styles.recordMeta}>Date: {formatDate(record.date)}</Text>}</View>
            {(record.provider || record.facility) && <View style={styles.fieldContainer}><Text style={styles.sectionTitle}>Record Information</Text>{renderField('Provider', record.provider)}{renderField('Facility', record.facility)}</View>}
            {(record.insulinPumpModel || record.totalDailyBasal || record.effectiveDate) && <View style={styles.fieldContainer} wrap={false}><Text style={styles.sectionTitle}>Pump Information</Text>{renderField('Insulin Pump Model', record.insulinPumpModel)}{renderField('Total Daily Basal', record.totalDailyBasal)}{renderField('Effective Date', formatDate(record.effectiveDate))}</View>}
            {(record.timeBlock || record.oldRate || record.newRate) && <View style={styles.fieldContainer}><Text style={styles.sectionTitle}>Rate Adjustment</Text>{renderField('Time Block', record.timeBlock)}{renderField('Old Rate', record.oldRate)}{renderField('New Rate', record.newRate)}{renderField('Reason for Change', record.reasonForChange)}{renderField('Glucose Pattern', record.glucosePattern)}</View>}
            {renderSentenceField('Follow-Up Plan', record.followUpPlan)}
            {renderSentenceField('Notes', record.notes)}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default BasalRateAdjustmentsPDFTemplate;
