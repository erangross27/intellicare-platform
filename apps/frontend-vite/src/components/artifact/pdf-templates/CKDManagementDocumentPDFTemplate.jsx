/**
 * CKDManagementDocumentPDFTemplate.jsx
 * Box-free line-based layout (ConsultationNotes donor) — LETTER size — B&W.
 * react-pdf 4.5.1 engine rules: wrap props are BOOLEANS (explicit undefined = unbreakable);
 * recordContainer paddingBottom only (marginBottom → empty page 1) + break={idx>0} (Rule #75, each
 * record starts a new page); section title inside the first field's View (anti-orphan, 6a2d6af6).
 * Every value numbered ("1." even for singles); numeric lab of 0 (unmeasured sentinel) hidden.
 * Collection: ckd_management
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
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#000000', borderBottomWidth: 0.5, borderBottomColor: '#999999', paddingBottom: 3, marginBottom: 4 },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 3, paddingLeft: 8 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#000000' },
});

const NUMBER_FIELDS = new Set(['estimatedGFR', 'serumCreatinine', 'bloodUreaNitrogen', 'albuminCreatinineRatio', 'hemoglobinLevel', 'calciumLevel', 'phosphorusLevel', 'parathyroidHormone', 'vitamin25OHD', 'dialysisAdequacyKtV', 'kidneySizeLeft', 'kidneySizeRight']);
const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; return true; };
const hasFieldVal = (fn, v) => { if (NUMBER_FIELDS.has(fn) && (v === 0 || v === '0')) return false; return hasVal(v); };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
const FL = {
  estimatedGFR: 'Estimated GFR', ckdStage: 'CKD Stage', serumCreatinine: 'Serum Creatinine',
  bloodUreaNitrogen: 'Blood Urea Nitrogen', proteinuria: 'Proteinuria', albuminCreatinineRatio: 'Albumin/Creatinine Ratio',
  hemoglobinLevel: 'Hemoglobin Level', calciumLevel: 'Calcium Level', phosphorusLevel: 'Phosphorus Level',
  parathyroidHormone: 'Parathyroid Hormone', vitamin25OHD: 'Vitamin 25-OH-D',
  dialysisModality: 'Dialysis Modality', dialysisAdequacyKtV: 'Dialysis Adequacy (Kt/V)',
  vascularAccessType: 'Vascular Access Type', transplantEvaluation: 'Transplant Evaluation',
  aceInhibitorUsage: 'ACE Inhibitor Usage', phosphateBinderTherapy: 'Phosphate Binder Therapy',
  erythropoietinTherapy: 'Erythropoietin Therapy',
  kidneySizeLeft: 'Kidney Size (Left)', kidneySizeRight: 'Kidney Size (Right)', kidneyEchotexture: 'Kidney Echotexture',
  comorbidDiabetes: 'Comorbid Diabetes', comorbidHypertension: 'Comorbid Hypertension',
  fluidOverloadStatus: 'Fluid Overload Status',
};

// section = one wrap-gated glue unit (small); section title inside; each field label + "1. value"
const renderFieldGroup = (title, fields, record) => {
  const visible = fields.filter(f => hasFieldVal(f, record[f]));
  if (visible.length === 0) return null;
  return (
    <View style={styles.section} wrap={visible.length * 2 + 1 > 8 ? true : false}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {visible.map((f, i) => (
        <View key={i} style={{ marginBottom: 4 }}>
          <Text style={styles.fieldLabel}>{FL[f] || f}</Text>
          <Text style={styles.listItem}>1. {fmtVal(record[f])}</Text>
        </View>
      ))}
    </View>
  );
};

const CKDManagementDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.ckd_management) return Array.isArray(r.ckd_management) ? r.ckd_management : [r.ckd_management];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.ckd_management) return Array.isArray(dd.ckd_management) ? dd.ckd_management : [dd.ckd_management]; return [dd]; }
      return r;
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (<Document><Page size="LETTER" style={styles.page}><View style={styles.documentHeader}><Text style={styles.title}>CKD Management</Text></View><Text style={styles.emptyState}>No records available</Text></Page></Document>);
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>CKD Management</Text></View>
        {records.map((record, idx) => (
          // Rule #75: every record after the first STARTS ON A NEW PAGE; never on record 0.
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`CKD Management ${idx + 1}`}</Text>
            </View>
            {renderFieldGroup('Kidney Function', ['estimatedGFR', 'ckdStage', 'serumCreatinine', 'bloodUreaNitrogen', 'proteinuria', 'albuminCreatinineRatio'], record)}
            {renderFieldGroup('Lab Values', ['hemoglobinLevel', 'calciumLevel', 'phosphorusLevel', 'parathyroidHormone', 'vitamin25OHD'], record)}
            {renderFieldGroup('Dialysis & Transplant', ['dialysisModality', 'dialysisAdequacyKtV', 'vascularAccessType', 'transplantEvaluation'], record)}
            {renderFieldGroup('Medications', ['aceInhibitorUsage', 'phosphateBinderTherapy', 'erythropoietinTherapy'], record)}
            {renderFieldGroup('Kidney Imaging', ['kidneySizeLeft', 'kidneySizeRight', 'kidneyEchotexture'], record)}
            {renderFieldGroup('Comorbidities', ['comorbidDiabetes', 'comorbidHypertension', 'fluidOverloadStatus'], record)}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default CKDManagementDocumentPDFTemplate;
