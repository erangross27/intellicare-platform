/**
 * ClinicalDecisionSupportPDFTemplate.jsx
 * Box-free line-based layout (ConsultationNotes donor) — LETTER size — B&W.
 * react-pdf 4.5.1 engine rules: wrap props are BOOLEANS (explicit undefined = unbreakable);
 * recordContainer paddingBottom only (marginBottom → empty page 1) + break={idx>0} (Rule #75, each
 * record starts a new page); sectionTitle rides INSIDE the first item's View (anti-orphan, 6a2d6af6).
 * Mirrors the JSX 4-area structure: section → item (name) → numbered sub-fields ("1." even for singles).
 * Collection: clinical_decision_support
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#000000' },
  title: { fontSize: 26, fontFamily: 'Helvetica-Bold', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1 },
  recordContainer: { paddingBottom: 8 },
  recordHeader: { marginBottom: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', textTransform: 'uppercase', letterSpacing: 0.5, borderBottomWidth: 1, borderBottomColor: '#000000', paddingBottom: 3, marginBottom: 8 },
  itemBlock: { marginBottom: 10 },
  itemTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 4 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#000000', borderBottomWidth: 0.5, borderBottomColor: '#999999', paddingBottom: 3, marginBottom: 4 },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 3, paddingLeft: 8 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#000000' },
});

const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };

// One section = flowing container of glue-unit items; sectionTitle rides inside the FIRST item (anti-orphan).
// item = { header?, pairs?: [[label, value]], list?: [value] }. Each item is a wrap-gated glue unit.
const renderSection = (title, items) => {
  const live = items
    .map(it => ({ header: it.header, pairs: (it.pairs || []).filter(([, v]) => hasVal(v)), list: (it.list || []).filter(hasVal) }))
    .filter(it => it.pairs.length > 0 || it.list.length > 0 || hasVal(it.header));
  if (live.length === 0) return null;
  return (
    <View style={styles.section}>
      {live.map((it, i) => (
        <View key={i} style={styles.itemBlock} wrap={it.list.length + it.pairs.length * 2 > 8 ? true : false}>
          {i === 0 && <Text style={styles.sectionTitle}>{title}</Text>}
          {hasVal(it.header) && <Text style={styles.itemTitle}>{fmtVal(it.header)}</Text>}
          {it.pairs.map(([label, value], j) => (
            <View key={j} style={{ marginBottom: 4 }}>
              <Text style={styles.fieldLabel}>{label}</Text>
              <Text style={styles.listItem}>1. {fmtVal(value)}</Text>
            </View>
          ))}
          {it.list.map((v, j) => <Text key={j} style={styles.listItem}>{j + 1}. {fmtVal(v)}</Text>)}
        </View>
      ))}
    </View>
  );
};

const ClinicalDecisionSupportPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.clinical_decision_support) return Array.isArray(r.clinical_decision_support) ? r.clinical_decision_support : [r.clinical_decision_support];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.clinical_decision_support) return Array.isArray(dd.clinical_decision_support) ? dd.clinical_decision_support : [dd.clinical_decision_support]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (<Document><Page size="LETTER" style={styles.page}><View style={styles.documentHeader}><Text style={styles.title}>Clinical Decision Support</Text></View><Text style={styles.emptyState}>No records available</Text></Page></Document>);
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Clinical Decision Support</Text></View>
        {records.map((record, idx) => {
          const ra = record.riskAssessment || {};
          return (
            // Rule #75: every record after the first STARTS ON A NEW PAGE; never on record 0.
            <View key={idx} style={styles.recordContainer} break={idx > 0}>
              <View style={styles.recordHeader} wrap={false}>
                <Text style={styles.recordTitle}>{`Clinical Decision Support ${idx + 1}`}</Text>
              </View>
              {renderSection('Overall Risk', [{ pairs: [['Risk Level', ra.overallRisk], ['Description', ra.riskDescription]] }])}
              {renderSection('Red Flags', (record.redFlags || []).map(f => ({ header: f.finding || 'Red Flag', pairs: [['Urgency', f.urgency], ['Action Required', f.action], ['Timeframe', f.timeframe]] })))}
              {renderSection('Risk Factors', (ra.riskFactors || []).map(f => ({ header: f.factor || 'Risk Factor', pairs: [['Severity', f.severity], ['Evidence', f.evidence]] })))}
              {renderSection('Mitigating Factors', [{ list: ra.mitigatingFactors || [] }])}
              {renderSection('Drug Interactions', (record.drugInteractions || []).map(d => ({ header: d.medications?.join(' + ') || 'Interaction', pairs: [['Severity', d.severity], ['Mechanism', d.mechanism], ['Clinical Effect', d.clinicalEffect], ['Recommendation', d.recommendation]] })))}
              {renderSection('Contraindications', (record.contraindications || []).map(c => ({ header: c.medication || 'Contraindication', pairs: [['Condition', c.condition], ['Severity', c.severity], ['Alternative', c.alternative]] })))}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default ClinicalDecisionSupportPDFTemplate;
