/**
 * BrainTumorCharacteristicsDocumentPDFTemplate.jsx
 * Helvetica 20/14/12pt, wrap={false} on sections
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 14, fontFamily: 'Helvetica', backgroundColor: '#ffffff' },
  documentTitle: { fontSize: 24, fontFamily: 'Helvetica-Bold', marginBottom: 14, textAlign: 'center', borderBottomWidth: 2, borderBottomColor: '#000000', paddingBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  recordSection: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#cccccc' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', marginBottom: 6, backgroundColor: '#f0f0f0', padding: 6, borderWidth: 1, borderColor: '#000000' },
  recordMeta: { fontSize: 13, marginBottom: 2, color: '#333333', paddingLeft: 4 },
  fieldContainer: { marginBottom: 10, marginTop: 4 },
  sectionTitle: { fontSize: 17, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', marginBottom: 6, borderBottomWidth: 1, borderBottomColor: '#000000', paddingBottom: 4 },
  subSectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 3, marginTop: 6, paddingLeft: 4 },
  listItem: { fontSize: 14, lineHeight: 1.5, paddingLeft: 12, marginBottom: 3 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#666666' },
});

const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return v !== 0; if (typeof v === 'string') return v.trim() !== ''; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };

const FL = { tumorHistology: 'Tumor Histology', whoGrade: 'WHO Grade', tumorLocation: 'Tumor Location', tumorSize: 'Tumor Size', enhancementPattern: 'Enhancement Pattern', perilesionalEdema: 'Perilesional Edema', midlineShift: 'Midline Shift', perfusionMetrics: 'Perfusion Metrics', diffusionRestriction: 'Diffusion Restriction', karnofskyPerformanceScore: 'Karnofsky Score', glasgowComaScale: 'Glasgow Coma Scale', idh1Mutation: 'IDH1 Mutation', mgmtPromoterMethylation: 'MGMT Methylation', p53Expression: 'p53 Expression', ki67Index: 'Ki-67 Index', chromosomeCodeletion: 'Chromosome Co-deletion', resectionExtent: 'Resection Extent', eloquentCortexInvolvement: 'Eloquent Cortex', vascularInvolvement: 'Vascular Involvement', bloodBrainBarrierDisruption: 'BBB Disruption', cerebrospinalFluidSeeding: 'CSF Seeding' };

const renderFieldGroup = (title, fields, record) => {
  const visible = fields.filter(f => hasVal(record[f]));
  if (visible.length === 0) return null;
  return (<View style={styles.fieldContainer} wrap={false}><Text style={styles.sectionTitle}>{title}</Text>{visible.map((f, i) => (<View key={i}><Text style={styles.subSectionTitle}>{FL[f] || f}</Text><Text style={styles.listItem}>{fmtVal(record[f])}</Text></View>))}</View>);
};

const BrainTumorCharacteristicsDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => { if (r?.brain_tumor_characteristics) return Array.isArray(r.brain_tumor_characteristics) ? r.brain_tumor_characteristics : [r.brain_tumor_characteristics]; if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.brain_tumor_characteristics) return Array.isArray(dd.brain_tumor_characteristics) ? dd.brain_tumor_characteristics : [dd.brain_tumor_characteristics]; return [dd]; } return r; });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) return <Document><Page size="A4" style={styles.page}><Text style={styles.documentTitle}>Brain Tumor Characteristics</Text><Text style={styles.emptyState}>No records available</Text></Page></Document>;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.documentTitle}>Brain Tumor Characteristics</Text>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordSection}>
            <View wrap={false}><Text style={styles.recordTitle}>{`Brain Tumor ${idx + 1}`}</Text>{(record.date || record.createdAt) && <Text style={styles.recordMeta}>{formatDate(record.date || record.createdAt)}</Text>}</View>
            {renderFieldGroup('Tumor Information', ['tumorHistology', 'whoGrade', 'tumorLocation', 'tumorSize'], record)}
            {renderFieldGroup('Imaging', ['enhancementPattern', 'perilesionalEdema', 'midlineShift', 'perfusionMetrics', 'diffusionRestriction'], record)}
            {renderFieldGroup('Clinical Scores', ['karnofskyPerformanceScore', 'glasgowComaScale'], record)}
            {renderFieldGroup('Molecular Markers', ['idh1Mutation', 'mgmtPromoterMethylation', 'p53Expression', 'ki67Index', 'chromosomeCodeletion'], record)}
            {renderFieldGroup('Surgical Planning', ['resectionExtent', 'eloquentCortexInvolvement', 'vascularInvolvement'], record)}
            {renderFieldGroup('Advanced', ['bloodBrainBarrierDisruption', 'cerebrospinalFluidSeeding'], record)}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default BrainTumorCharacteristicsDocumentPDFTemplate;
