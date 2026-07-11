/**
 * CancerScreeningRecordsDocumentPDFTemplate.jsx
 * Helvetica 20/14/12pt
 * Collection: cancer_screening_records
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
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#666666' },
});

const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };

const FL = {
  screeningType: 'Screening Type', cancerTypeScreened: 'Cancer Type Screened',
  screeningInterval: 'Screening Interval', indicationForScreening: 'Indication',
  imagingModalityUsed: 'Imaging Modality', riskCategory: 'Risk Category',
  familyHistoryOfCancer: 'Family History of Cancer', biRadsCategory: 'BI-RADS Category',
  colonoscopyFindings: 'Colonoscopy Findings', polypCount: 'Polyp Count',
  polypHistology: 'Polyp Histology', cecalIntubation: 'Cecal Intubation',
  bowelPrepQuality: 'Bowel Prep Quality', papSmearResult: 'Pap Smear Result',
  hpvTestResult: 'HPV Test Result', psaLevel: 'PSA Level',
  ldctLungRadsScore: 'LDCT Lung-RADS Score', packYearHistory: 'Pack-Year History',
  biopsyPerformed: 'Biopsy Performed', biopsySite: 'Biopsy Site',
  pathologyReportNumber: 'Pathology Report Number', requiresFollowUp: 'Requires Follow-Up',
};

// Rule #74 (anti-orphan / anti-split): each field is ONE wrap={false} View holding label+value together,
// and the sectionTitle lives INSIDE the first field's View (never a standalone sibling). These fields are
// single-value (1 row each) so wrap={false} never has to compress → no orphan, no label/value split.
const renderFieldGroup = (title, fields, record) => {
  const visible = fields.filter(f => hasVal(record[f]));
  if (visible.length === 0) return null;
  return (
    <View style={styles.fieldContainer}>
      {visible.map((f, i) => (
        <View key={i} wrap={false}>
          {i === 0 && <Text style={styles.sectionTitle}>{title}</Text>}
          <Text style={styles.subSectionTitle}>{FL[f] || f}</Text>
          <Text style={styles.listItem}>{fmtVal(record[f])}</Text>
        </View>
      ))}
    </View>
  );
};

const CancerScreeningRecordsDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.cancer_screening_records) return Array.isArray(r.cancer_screening_records) ? r.cancer_screening_records : [r.cancer_screening_records];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.cancer_screening_records) return Array.isArray(dd.cancer_screening_records) ? dd.cancer_screening_records : [dd.cancer_screening_records]; return [dd]; }
      return r;
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) return <Document><Page size="A4" style={styles.page}><Text style={styles.documentTitle}>Cancer Screening Records</Text><Text style={styles.emptyState}>No records available</Text></Page></Document>;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.documentTitle}>Cancer Screening Records</Text>
        {records.map((record, idx) => (
          // Rule #75: every record after the first starts on a NEW page (break = page-break-before; not on record 0).
          <View key={idx} style={styles.recordSection} break={idx > 0}>
            <View wrap={false}>
              <Text style={styles.recordTitle}>{`Cancer Screening Record ${idx + 1}`}</Text>
              {record.date && <Text style={styles.recordMeta}>{formatDate(record.date)}</Text>}
              {record.cancerTypeScreened && <Text style={styles.recordMeta}>{record.cancerTypeScreened}</Text>}
            </View>

            {renderFieldGroup('Screening Information', ['screeningType', 'cancerTypeScreened', 'screeningInterval', 'indicationForScreening', 'imagingModalityUsed'], record)}

            {(record.screeningDate || record.previousScreeningDate || record.nextRecommendedScreeningDate) && (
              <View style={styles.fieldContainer}>
                {[['Screening Date', record.screeningDate], ['Previous Screening', record.previousScreeningDate], ['Next Recommended', record.nextRecommendedScreeningDate]]
                  .filter(([, v]) => hasVal(v))
                  .map(([label, v], i) => (
                    <View key={i} wrap={false}>
                      {i === 0 && <Text style={styles.sectionTitle}>Screening Dates</Text>}
                      <Text style={styles.subSectionTitle}>{label}</Text>
                      <Text style={styles.listItem}>{formatDate(v)}</Text>
                    </View>
                  ))}
              </View>
            )}

            {renderFieldGroup('Risk Factors', ['riskCategory', 'familyHistoryOfCancer'], record)}
            {renderFieldGroup('Mammography', ['biRadsCategory'], record)}
            {renderFieldGroup('Colonoscopy', ['colonoscopyFindings', 'polypCount', 'polypHistology', 'cecalIntubation', 'bowelPrepQuality'], record)}
            {renderFieldGroup('Cervical Screening', ['papSmearResult', 'hpvTestResult'], record)}
            {renderFieldGroup('Prostate Screening', ['psaLevel'], record)}
            {renderFieldGroup('Lung Screening', ['ldctLungRadsScore', 'packYearHistory'], record)}
            {renderFieldGroup('Biopsy', ['biopsyPerformed', 'biopsySite', 'pathologyReportNumber'], record)}
            {renderFieldGroup('Follow-Up', ['requiresFollowUp'], record)}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default CancerScreeningRecordsDocumentPDFTemplate;
