/**
 * FirstTrimesterScreenResultDocumentPDFTemplate.jsx
 * Box-free B&W LETTER (canonical, memory 6a2d6af6) — mirrors the JSX: numbers numbered ('1.' even singles) with
 * zero-sentinel hide (pappALevel/freeBetaHcgLevel/foetalHeartRate/bipariatalDiameter/maternalWeight read 0 across
 * every populated record = never-measured), booleans Yes/No, ductusVenosusFlow enum canonical, gestationalAge
 * kept whole, trisomy risks/ethnicity text. NO date/provider (schema has none). Rule #74: each field is ONE
 * wrap={false} atomic View with the sectionTitle riding INSIDE the first present field's View. Static PHI footer.
 * Collection: first_trimester_screen_result
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 16 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', textAlign: 'center', color: '#000000', paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000' },
  recordContainer: { marginBottom: 20 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 12, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#000000' },
  section: { marginBottom: 16 },
  fieldGroup: { marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000' },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 4, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  value: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#000000' },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, borderTopWidth: 0.5, borderTopColor: '#999999', paddingTop: 8 },
  footerText: { fontSize: 10, color: '#666666' },
});

const SECTION_ORDER = ['risk-assessment', 'ultrasound-measurements', 'biochemistry-markers', 'doppler-flow', 'maternal-info', 'pregnancy-details', 'recommendations'];
const SECTION_TITLES = {
  'risk-assessment': 'Risk Assessment',
  'ultrasound-measurements': 'Ultrasound Measurements',
  'biochemistry-markers': 'Biochemistry Markers',
  'doppler-flow': 'Doppler & Flow',
  'maternal-info': 'Maternal Information',
  'pregnancy-details': 'Pregnancy Details',
  'recommendations': 'Recommendations',
};
const SECTION_FIELDS = {
  'risk-assessment': ['trisomy21Risk', 'trisomy18Risk', 'trisomy13Risk', 'screenPositive'],
  'ultrasound-measurements': ['crownRumpLength', 'nuchalTranslucency', 'bipariatalDiameter', 'foetalHeartRate', 'nasalBonePresent'],
  'biochemistry-markers': ['pappALevel', 'pappAMom', 'freeBetaHcgLevel', 'freeBetaHcgMom'],
  'doppler-flow': ['ductusVenosusFlow', 'tricuspidRegurgitation'],
  'maternal-info': ['maternalAge', 'maternalWeight', 'ethnicity'],
  'pregnancy-details': ['gestationalAge', 'multipleFetuses', 'chorionicityType'],
  'recommendations': ['geneticCounsellingRecommended', 'diagnosticTestingOffered'],
};
const FIELD_LABELS = {
  trisomy21Risk: 'Trisomy 21 Risk', trisomy18Risk: 'Trisomy 18 Risk', trisomy13Risk: 'Trisomy 13 Risk', screenPositive: 'Screen Positive',
  crownRumpLength: 'Crown-Rump Length', nuchalTranslucency: 'Nuchal Translucency', bipariatalDiameter: 'Biparietal Diameter', foetalHeartRate: 'Foetal Heart Rate', nasalBonePresent: 'Nasal Bone Present',
  pappALevel: 'PAPP-A Level', pappAMom: 'PAPP-A MoM', freeBetaHcgLevel: 'Free Beta-hCG Level', freeBetaHcgMom: 'Free Beta-hCG MoM',
  ductusVenosusFlow: 'Ductus Venosus Flow', tricuspidRegurgitation: 'Tricuspid Regurgitation',
  maternalAge: 'Maternal Age', maternalWeight: 'Maternal Weight', ethnicity: 'Ethnicity',
  gestationalAge: 'Gestational Age', multipleFetuses: 'Multiple Fetuses', chorionicityType: 'Chorionicity Type',
  geneticCounsellingRecommended: 'Genetic Counselling Recommended', diagnosticTestingOffered: 'Diagnostic Testing Offered',
};
const BOOLEAN_FIELDS = ['screenPositive', 'nasalBonePresent', 'tricuspidRegurgitation', 'multipleFetuses', 'geneticCounsellingRecommended', 'diagnosticTestingOffered'];
const ENUM_FIELDS = ['ductusVenosusFlow'];
const ENUM_OPTIONS = { ductusVenosusFlow: ['Normal', 'Abnormal', 'Reversed A-wave'] };
const enumCanonical = (options, val) => { const cur = String(val ?? '').trim(); const hit = (options || []).find(o => o.toLowerCase() === cur.toLowerCase()); return hit || cur; };
const ZERO_SENTINEL_FIELDS = ['pappALevel', 'freeBetaHcgLevel', 'foetalHeartRate', 'bipariatalDiameter', 'maternalWeight'];

const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'number' ? String(val) : typeof val === 'boolean' ? (val ? 'Yes' : 'No') : String(val);
  str = str.replace(/[µμ]m/g, 'um').replace(/[µμ]g/g, 'mcg').replace(/[µμ]/g, 'u').replace(/°/g, ' deg').replace(/±/g, '+/-')
    .replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/→/g, '->').replace(/“/g, '"').replace(/”/g, '"')
    .replace(/‘/g, "'").replace(/’/g, "'").replace(/—/g, '-').replace(/–/g, '-');
  return str;
};

const fieldVisible = (record, f) => {
  const v = record[f];
  if (typeof v === 'boolean') return true;
  if (v === null || v === undefined || v === '') return false;
  if (ZERO_SENTINEL_FIELDS.includes(f) && Number(v) === 0) return false;
  if (typeof v === 'string') return v.trim() !== '';
  return true;
};

const renderField = (record, f, sectionTitle, isFirst) => {
  const val = record[f];
  const label = FIELD_LABELS[f] || f;
  const showLabel = label.trim().toLowerCase() !== (sectionTitle || '').trim().toLowerCase();
  const titleNode = isFirst ? <Text style={styles.sectionTitle}>{sectionTitle}</Text> : null;
  let displayVal;
  if (BOOLEAN_FIELDS.includes(f)) displayVal = (typeof val === 'boolean' ? (val ? 'Yes' : 'No') : safeString(val));
  else if (ENUM_FIELDS.includes(f)) displayVal = safeString(enumCanonical(ENUM_OPTIONS[f], val));
  else displayVal = safeString(val);
  return (
    <View key={f} style={styles.fieldGroup} wrap={false}>
      {titleNode}
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      <Text style={styles.value}>1. {displayVal}</Text>
    </View>
  );
};

const FirstTrimesterScreenResultDocumentPDFTemplate = ({ document: docData }) => {
  let records = [];
  if (Array.isArray(docData)) records = docData;
  else if (docData?.first_trimester_screen_result) records = Array.isArray(docData.first_trimester_screen_result) ? docData.first_trimester_screen_result : [docData.first_trimester_screen_result];
  else if (docData?.documentData) { const dd = docData.documentData; if (Array.isArray(dd)) records = dd; else if (dd?.first_trimester_screen_result) records = Array.isArray(dd.first_trimester_screen_result) ? dd.first_trimester_screen_result : [dd.first_trimester_screen_result]; else records = [dd]; }
  else if (docData) records = [docData];
  records = records.filter(r => r && typeof r === 'object');

  if (!records || records.length === 0) {
    return (
      <Document><Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>First Trimester Screen Result</Text></View>
        <Text style={styles.emptyState}>No first trimester screen result data available.</Text>
      </Page></Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>First Trimester Screen Result</Text></View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <Text style={styles.recordTitle}>{`First Trimester Screen Result ${idx + 1}`}</Text>
            {SECTION_ORDER.map((sid) => {
              const vis = (SECTION_FIELDS[sid] || []).filter(f => fieldVisible(record, f));
              if (vis.length === 0) return null;
              return (
                <View key={sid} style={styles.section}>
                  {vis.map((f, fi) => renderField(record, f, SECTION_TITLES[sid], fi === 0))}
                </View>
              );
            })}
          </View>
        ))}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Protected Health Information (PHI) - Handle according to HIPAA guidelines</Text>
        </View>
      </Page>
    </Document>
  );
};

export default FirstTrimesterScreenResultDocumentPDFTemplate;
