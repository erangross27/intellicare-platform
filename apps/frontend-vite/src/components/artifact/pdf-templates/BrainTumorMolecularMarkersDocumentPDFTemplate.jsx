/**
 * BrainTumorMolecularMarkersDocumentPDFTemplate.jsx
 * Helvetica 20/14/12pt, wrap={false) on sections
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
  itemLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', marginTop: 3, paddingLeft: 12 },
  listItem: { fontSize: 14, lineHeight: 1.5, paddingLeft: 12, marginBottom: 3 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#666666' },
});

const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'string') return v.trim() !== ''; if (typeof v === 'object' && Object.keys(v).length === 0) return false; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; return String(v || ''); };
const hasObjData = (obj) => obj && typeof obj === 'object' && Object.keys(obj).length > 0 && Object.values(obj).some(v => hasVal(v));
/* Abbreviation-safe sentence split — mirrors the JSX template (segmentation parity). */
const ABBR_RE = '(?:Mr|Mrs|Ms|Dr|Prof|Rev|Sr|Jr|St|Gen|Col|Sgt|Lt|Capt|vs|etc)';
const splitBySentence = (text) => { if (!text) return []; return String(text).split(new RegExp(`(?<!\\b${ABBR_RE}\\.)(?<=[.!?])\\s+`)).map(s => s.trim()).filter(s => s.length > 0 && s.replace(/[.!?;,]+/g, '').trim().length > 0); };
const NL = { tested: 'Tested', result: 'Result', prognosticImplication: 'Prognostic Implication', diagnosticImplication: 'Diagnostic Implication', therapeuticImplication: 'Therapeutic Implication', specificMutation: 'Specific Mutation', method: 'Method', methylationPercentage: 'Methylation Percentage', percentage: 'Percentage', interpretation: 'Interpretation', egfrvIIIMutation: 'EGFRvIII Mutation', tumorType: 'Associated Tumor Type', location: 'Location', performed: 'Performed', panelName: 'Panel Name', genesAnalyzed: 'Genes Analyzed', additionalMutations: 'Additional Mutations', tumorMutationBurden: 'Tumor Mutation Burden', microsatelliteStatus: 'Microsatellite Status', chemotherapyGuidance: 'Chemotherapy Guidance', radiationGuidance: 'Radiation Guidance', targetedTherapy: 'Targeted Therapy', immunotherapy: 'Immunotherapy', prognosticCounseling: 'Prognostic Counseling', specimenType: 'Specimen Type', specimenDate: 'Specimen Date', pathologyReportDate: 'Pathology Report Date', laboratory: 'Laboratory', tumorCellularity: 'Tumor Cellularity', molecularTarget: 'Molecular Target', drugClass: 'Drug Class', trialExample: 'Trial Example', eligibility: 'Eligibility' };

const renderObjSection = (title, obj) => {
  if (!hasObjData(obj)) return null;
  const entries = Object.entries(obj).filter(([, v]) => hasVal(v));
  if (entries.length === 0) return null;
  const rowCount = entries.reduce((n, [, v]) => n + (typeof v !== 'boolean' && splitBySentence(fmtVal(v)).length > 1 ? splitBySentence(fmtVal(v)).length : 1), 0);
  return (<View style={styles.fieldContainer} wrap={rowCount > 8}><Text style={styles.sectionTitle}>{title}</Text>{entries.map(([k, v], i) => { const dv = fmtVal(v); const sents = typeof v !== 'boolean' ? splitBySentence(dv) : [dv]; return (<View key={i}><Text style={styles.subSectionTitle}>{NL[k] || k}</Text>{sents.length > 1 ? sents.map((s, j) => <Text key={j} style={styles.listItem}>{j + 1}. {s.replace(/\.$/, '')}</Text>) : <Text style={styles.listItem}>{dv}</Text>}</View>); })}</View>);
};

const renderArraySection = (title, arr) => {
  if (!Array.isArray(arr)) return null;
  const items = arr.filter(it => hasObjData(it) || hasVal(it));
  if (items.length === 0) return null;
  const rowCount = items.reduce((n, it) => n + (typeof it === 'object' ? Object.entries(it).filter(([, v]) => hasVal(v)).reduce((m, [, v]) => m + (typeof v !== 'boolean' && splitBySentence(fmtVal(v)).length > 1 ? splitBySentence(fmtVal(v)).length : 1), 1) : 1), 0);
  return (<View style={styles.fieldContainer} wrap={rowCount > 8}><Text style={styles.sectionTitle}>{title}</Text>{items.map((it, i) => (<View key={i}><Text style={styles.subSectionTitle}>{`Trial ${i + 1}`}</Text>{typeof it === 'object' ? Object.entries(it).filter(([, v]) => hasVal(v)).map(([k, v], j) => { const dv = fmtVal(v); const sents = typeof v !== 'boolean' ? splitBySentence(dv) : [dv]; return (<View key={j}><Text style={styles.itemLabel}>{NL[k] || k}</Text>{sents.length > 1 ? sents.map((s, m) => <Text key={m} style={styles.listItem}>{m + 1}. {s.replace(/\.$/, '')}</Text>) : <Text style={styles.listItem}>{dv}</Text>}</View>); }) : <Text style={styles.listItem}>{fmtVal(it)}</Text>}</View>))}</View>);
};

const BrainTumorMolecularMarkersDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => { if (r?.brain_tumor_molecular_markers) return Array.isArray(r.brain_tumor_molecular_markers) ? r.brain_tumor_molecular_markers : [r.brain_tumor_molecular_markers]; if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.brain_tumor_molecular_markers) return Array.isArray(dd.brain_tumor_molecular_markers) ? dd.brain_tumor_molecular_markers : [dd.brain_tumor_molecular_markers]; return [dd]; } return r; });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) return <Document><Page size="A4" style={styles.page}><Text style={styles.documentTitle}>Brain Tumor Molecular Markers</Text><Text style={styles.emptyState}>No records available</Text></Page></Document>;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.documentTitle}>Brain Tumor Molecular Markers</Text>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordSection}>
            <View wrap={false}><Text style={styles.recordTitle}>{`Molecular Markers ${idx + 1}`}</Text>{record.date && <Text style={styles.recordMeta}>{formatDate(record.date)}</Text>}</View>
            {(hasVal(record.tumorType) || hasVal(record.whoGrade) || hasVal(record.molecularClassification)) && (<View style={styles.fieldContainer} wrap={false}><Text style={styles.sectionTitle}>Classification</Text>{hasVal(record.tumorType) && <><Text style={styles.subSectionTitle}>Tumor Type</Text><Text style={styles.listItem}>{fmtVal(record.tumorType)}</Text></>}{hasVal(record.whoGrade) && <><Text style={styles.subSectionTitle}>WHO Grade</Text><Text style={styles.listItem}>{fmtVal(record.whoGrade)}</Text></>}{hasVal(record.molecularClassification) && <><Text style={styles.subSectionTitle}>Molecular Classification</Text><Text style={styles.listItem}>{record.molecularClassification}</Text></>}</View>)}
            {renderObjSection('IDH Status', record.idhStatus)}
            {renderObjSection('1p/19q Co-deletion', record.codeletionStatus)}
            {renderObjSection('MGMT Status', record.mgmtStatus)}
            {renderObjSection('TERT Promoter', record.tertPromoterStatus)}
            {renderObjSection('ATRX Status', record.atrxStatus)}
            {renderObjSection('TP53 Status', record.tp53Status)}
            {renderObjSection('Ki-67 Index', record.ki67ProliferationIndex)}
            {renderObjSection('EGFR Status', record.egfrStatus)}
            {renderObjSection('CDKN2A Status', record.cdkn2aStatus)}
            {renderObjSection('BRAF Status', record.brafStatus)}
            {renderObjSection('H3 Status', record.h3Status)}
            {renderObjSection('NGS Panel', record.ngsPanel)}
            {renderObjSection('Treatment Recommendations', record.treatmentRecommendations)}
            {renderArraySection('Clinical Trial Eligibility', record.clinicalTrialEligibility)}
            {renderObjSection('Specimen Details', record.specimen)}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default BrainTumorMolecularMarkersDocumentPDFTemplate;
