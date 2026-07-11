/**
 * CellFreeDnaResultDocumentPDFTemplate.jsx
 * Box-free line-based layout (ConsultationNotes donor) — LETTER size — B&W.
 * react-pdf 4.5.1 engine rules: wrap props are BOOLEANS (explicit undefined = unbreakable);
 * recordContainer uses paddingBottom only (marginBottom shoves the whole record → empty page 1).
 * Collection: cell_free_dna_result
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 24, borderBottomWidth: 2, borderBottomColor: '#000000', paddingBottom: 12 },
  title: { fontSize: 26, fontFamily: 'Helvetica-Bold', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1 },
  recordContainer: { paddingBottom: 8 },
  recordHeader: { marginBottom: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold' },
  recordMeta: { fontSize: 12, color: '#333333', marginTop: 4 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', textTransform: 'uppercase', letterSpacing: 0.5, borderBottomWidth: 1, borderBottomColor: '#000000', paddingBottom: 3, marginBottom: 8 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#000000', borderBottomWidth: 0.5, borderBottomColor: '#999999', paddingBottom: 3, marginBottom: 4 },
  listItem: { fontSize: 14, lineHeight: 1.5, marginBottom: 3, paddingLeft: 8 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#666666' },
});

const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return v !== 0; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
const safeArr = (v) => Array.isArray(v) ? v.filter(Boolean) : [];

const FL = {
  trisomy21Risk: 'Trisomy 21 (Down Syndrome)', trisomy18Risk: 'Trisomy 18 (Edwards Syndrome)', trisomy13Risk: 'Trisomy 13 (Patau Syndrome)', sexChromosomeAneuploidyRisk: 'Sex Chromosome Aneuploidy',
  fetalSexDetermination: 'Fetal Sex', yChromosomeDetected: 'Y Chromosome Detected',
  cfDnaConcentration: 'cfDNA Concentration', cfDnaIntegrity: 'cfDNA Integrity', fetalFraction: 'Fetal Fraction',
  zScoreChromosome21: 'Z-Score Chromosome 21', zScoreChromosome18: 'Z-Score Chromosome 18', zScoreChromosome13: 'Z-Score Chromosome 13',
  gestationalAgeAtTesting: 'Gestational Age', testMethodology: 'Test Methodology', laboratoryAccreditation: 'Laboratory Accreditation',
  maternalAge: 'Maternal Age', maternalBMI: 'Maternal BMI',
  sequenceReads: 'Sequence Reads', mappedReads: 'Mapped Reads', qualityScore: 'Quality Score',
  microdeletionScreening: 'Microdeletion Screening',
  testFailureReason: 'Failure Reason', redrawRecommendation: 'Redraw Recommendation', invasiveDiagnosticRecommended: 'Invasive Diagnostic Recommended',
};

// single-name rule: field label == section title → the label is not repeated under the title
const showLbl = (f, sTitle) => (FL[f] || f).toLowerCase() !== String(sTitle).toLowerCase();

const renderFieldSection = (sTitle, fields, record) => {
  const visible = fields.filter(f => hasVal(record[f]));
  if (visible.length === 0) return null;
  return (
    <View style={styles.section} wrap={visible.length * 2 > 8 ? true : false}>
      <Text style={styles.sectionTitle}>{sTitle}</Text>
      {visible.map((f, i) => (
        <View key={i} style={{ marginBottom: 6 }}>
          {showLbl(f, sTitle) && <Text style={styles.fieldLabel}>{FL[f] || f}</Text>}
          <Text style={styles.listItem}>1. {fmtVal(record[f])}</Text>
        </View>
      ))}
    </View>
  );
};

const renderArraySection = (sTitle, items) => {
  const arr = safeArr(items);
  if (arr.length === 0) return null;
  return (
    <View style={styles.section} wrap={arr.length > 8 ? true : false}>
      <Text style={styles.sectionTitle}>{sTitle}</Text>
      {arr.map((it, i) => <Text key={i} style={styles.listItem}>{i + 1}. {it}</Text>)}
    </View>
  );
};

const CellFreeDnaResultDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.cell_free_dna_result) return Array.isArray(r.cell_free_dna_result) ? r.cell_free_dna_result : [r.cell_free_dna_result];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.cell_free_dna_result) return Array.isArray(dd.cell_free_dna_result) ? dd.cell_free_dna_result : [dd.cell_free_dna_result]; return [dd]; }
      return r;
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (<Document><Page size="LETTER" style={styles.page}><View style={styles.documentHeader}><Text style={styles.title}>Cell-Free DNA Result</Text></View><Text style={styles.emptyState}>No records available</Text></Page></Document>);
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Cell-Free DNA Result</Text></View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`Cell-Free DNA Result ${idx + 1}`}</Text>
              {(record.date || record.createdAt) && <Text style={styles.recordMeta}>{formatDate(record.date || record.createdAt)}</Text>}
            </View>
            {renderFieldSection('Trisomy Risk Assessment', ['trisomy21Risk', 'trisomy18Risk', 'trisomy13Risk', 'sexChromosomeAneuploidyRisk'], record)}
            {renderFieldSection('Fetal Sex Determination', ['fetalSexDetermination', 'yChromosomeDetected'], record)}
            {renderFieldSection('DNA Analysis', ['cfDnaConcentration', 'cfDnaIntegrity', 'fetalFraction'], record)}
            {renderFieldSection('Z-Scores', ['zScoreChromosome21', 'zScoreChromosome18', 'zScoreChromosome13'], record)}
            {renderFieldSection('Testing Information', ['gestationalAgeAtTesting', 'testMethodology', 'laboratoryAccreditation'], record)}
            {renderFieldSection('Maternal Information', ['maternalAge', 'maternalBMI'], record)}
            {renderFieldSection('Quality Metrics', ['sequenceReads', 'mappedReads', 'qualityScore'], record)}
            {renderArraySection('Microdeletion Screening', record.microdeletionScreening)}
            {renderFieldSection('Test Status', ['testFailureReason', 'redrawRecommendation', 'invasiveDiagnosticRecommended'], record)}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default CellFreeDnaResultDocumentPDFTemplate;
