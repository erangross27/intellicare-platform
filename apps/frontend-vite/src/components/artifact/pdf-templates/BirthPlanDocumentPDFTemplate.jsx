/**
 * BirthPlanDocumentPDFTemplate.jsx
 * Helvetica 20/16/14/12pt, numbered items, conditional wrap, B&W only (#000000 + grayscale).
 * Renders all 18 non-system fields incl. findings, assessment, plan, results (object),
 * recommendations (array), date (header).
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 12, fontFamily: 'Helvetica', backgroundColor: '#ffffff' },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', marginBottom: 14, textAlign: 'center', borderBottomWidth: 2, borderBottomColor: '#000000', paddingBottom: 8, textTransform: 'uppercase', letterSpacing: 1, color: '#000000' },
  recordSection: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#cccccc' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginBottom: 6, backgroundColor: '#f0f0f0', padding: 6, borderWidth: 1, borderColor: '#000000', color: '#000000' },
  recordMeta: { fontSize: 11, marginBottom: 2, color: '#333333', paddingLeft: 4 },
  fieldContainer: { marginBottom: 10, marginTop: 4 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', marginBottom: 6, borderBottomWidth: 1, borderBottomColor: '#000000', paddingBottom: 4, color: '#000000' },
  subSectionTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 3, marginTop: 6, paddingLeft: 4 },
  nestedSubTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#333333', marginBottom: 2, marginTop: 3, paddingLeft: 16 },
  listItem: { fontSize: 12, lineHeight: 1.5, paddingLeft: 12, marginBottom: 3, color: '#000000' },
  nestedItem: { fontSize: 12, lineHeight: 1.5, paddingLeft: 24, marginBottom: 3, color: '#000000' },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#666666' },
});

const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
const isEmptyDeep = (v) => {
  if (v === null || v === undefined) return true;
  if (typeof v === 'boolean') return false;
  if (typeof v === 'number') return !Number.isFinite(v);
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0;
  if (typeof v === 'object') return Object.values(v).every(isEmptyDeep);
  return false;
};
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
const isScalar = (v) => v === null || typeof v !== 'object';
const humanizeKey = (key) => {
  const OV = { skinToSkin: 'Skin to Skin', delayedCordClamping: 'Delayed Cord Clamping', cordBloodBanking: 'Cord Blood Banking', placentaPreference: 'Placenta Preference' };
  if (OV[key]) return OV[key];
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

// Render a (possibly nested) object as label/value lines
const renderObjectLines = (value, depth) => {
  if (isScalar(value)) return null;
  return Object.entries(value).filter(([, v]) => !isEmptyDeep(v)).map(([k, v]) => {
    if (isScalar(v)) {
      return (
        <React.Fragment key={k}>
          <Text style={depth > 0 ? styles.nestedSubTitle : styles.subSectionTitle}>{humanizeKey(k)}</Text>
          <Text style={depth > 0 ? styles.nestedItem : styles.listItem}>{fmtScalar(v)}</Text>
        </React.Fragment>
      );
    }
    return (
      <React.Fragment key={k}>
        <Text style={depth > 0 ? styles.nestedSubTitle : styles.subSectionTitle}>{humanizeKey(k)}</Text>
        {renderObjectLines(v, depth + 1)}
      </React.Fragment>
    );
  });
};

const BirthPlanDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => { if (r?.birth_plan) return Array.isArray(r.birth_plan) ? r.birth_plan : [r.birth_plan]; if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.birth_plan) return Array.isArray(dd.birth_plan) ? dd.birth_plan : [dd.birth_plan]; return [dd]; } return r; });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) return <Document><Page size="A4" style={styles.page}><Text style={styles.documentTitle}>Birth Plan</Text><Text style={styles.emptyState}>No records available</Text></Page></Document>;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.documentTitle}>Birth Plan</Text>
        {records.map((record, idx) => {
          const pp = record.immediatePostpartum;
          const rs = record.results;
          const painItems = Array.isArray(record.painManagement) ? record.painManagement.filter(Boolean) : [];
          const laborItems = Array.isArray(record.laborSupport) ? record.laborSupport.filter(Boolean) : [];
          const rcpItems = Array.isArray(record.religiousCulturalPreferences) ? record.religiousCulturalPreferences.filter(Boolean) : [];
          const recItems = Array.isArray(record.recommendations) ? record.recommendations.filter(r => !isEmptyDeep(r)) : [];
          const countSentences = (t) => (typeof t === 'string' ? t.split(/[.;]\s+/).filter(Boolean).length : 0);
          const clinicalRows = countSentences(record.findings) + countSentences(record.assessment) + countSentences(record.plan) + (rs && !isEmptyDeep(rs) ? Object.keys(rs).length : 0);
          const notesRows = countSentences(record.notes);
          return (
            <View key={idx} style={styles.recordSection}>
              <View wrap={false}><Text style={styles.recordTitle}>{`Birth Plan ${idx + 1}`}</Text>{(record.date || record.createdAt) && <Text style={styles.recordMeta}>{formatDate(record.date || record.createdAt)}</Text>}</View>

              {(record.date || record.provider || record.facility || record.status) && (<View style={styles.fieldContainer} wrap={false}><Text style={styles.sectionTitle}>Plan Information</Text>{record.date && <><Text style={styles.subSectionTitle}>Date</Text><Text style={styles.listItem}>{formatDate(record.date)}</Text></>}{record.provider && <><Text style={styles.subSectionTitle}>Provider</Text><Text style={styles.listItem}>{record.provider}</Text></>}{record.facility && <><Text style={styles.subSectionTitle}>Facility</Text><Text style={styles.listItem}>{record.facility}</Text></>}{record.status && <><Text style={styles.subSectionTitle}>Status</Text><Text style={styles.listItem}>{record.status}</Text></>}</View>)}

              {record.deliveryPreference && (<View style={styles.fieldContainer} wrap={false}><Text style={styles.sectionTitle}>Delivery Preferences</Text><Text style={styles.subSectionTitle}>Delivery Preference</Text><Text style={styles.listItem}>{record.deliveryPreference}</Text></View>)}

              {painItems.length > 0 && (<View style={styles.fieldContainer} wrap={false}><Text style={styles.sectionTitle}>Pain Management</Text>{painItems.map((item, i) => <Text key={i} style={styles.listItem}>{i + 1}. {item}</Text>)}</View>)}

              {laborItems.length > 0 && (<View style={styles.fieldContainer} wrap={false}><Text style={styles.sectionTitle}>Labor Support</Text>{laborItems.map((item, i) => <Text key={i} style={styles.listItem}>{i + 1}. {item}</Text>)}</View>)}

              {pp && !isEmptyDeep(pp) && (<View style={styles.fieldContainer} wrap={false}><Text style={styles.sectionTitle}>Immediate Postpartum</Text>{renderObjectLines(pp, 0)}</View>)}

              {(record.feedingPlan || record.circumcisionPreference) && (<View style={styles.fieldContainer} wrap={false}><Text style={styles.sectionTitle}>Feeding & Newborn Care</Text>{record.feedingPlan && <><Text style={styles.subSectionTitle}>Feeding Plan</Text><Text style={styles.listItem}>{record.feedingPlan}</Text></>}{record.circumcisionPreference && <><Text style={styles.subSectionTitle}>Circumcision Preference</Text><Text style={styles.listItem}>{record.circumcisionPreference}</Text></>}</View>)}

              {(record.visitorsPolicy || rcpItems.length > 0) && (<View style={styles.fieldContainer} wrap={false}><Text style={styles.sectionTitle}>Visitors & Cultural</Text>{record.visitorsPolicy && <><Text style={styles.subSectionTitle}>Visitors Policy</Text><Text style={styles.listItem}>{record.visitorsPolicy}</Text></>}{rcpItems.length > 0 && <><Text style={styles.subSectionTitle}>Religious/Cultural Preferences</Text>{rcpItems.map((item, i) => <Text key={i} style={styles.listItem}>{i + 1}. {item}</Text>)}</>}</View>)}

              {(record.findings || record.assessment || record.plan || (rs && !isEmptyDeep(rs))) && (<View style={styles.fieldContainer} wrap={clinicalRows > 8 ? undefined : false}><Text style={styles.sectionTitle}>Clinical Summary</Text>{record.findings && <><Text style={styles.subSectionTitle}>Findings</Text><Text style={styles.listItem}>{record.findings}</Text></>}{record.assessment && <><Text style={styles.subSectionTitle}>Assessment</Text><Text style={styles.listItem}>{record.assessment}</Text></>}{record.plan && <><Text style={styles.subSectionTitle}>Plan</Text><Text style={styles.listItem}>{record.plan}</Text></>}{rs && !isEmptyDeep(rs) && <><Text style={styles.subSectionTitle}>Results</Text>{renderObjectLines(rs, 1)}</>}</View>)}

              {recItems.length > 0 && (<View style={styles.fieldContainer} wrap={recItems.length > 8 ? undefined : false}><Text style={styles.sectionTitle}>Recommendations</Text>{recItems.map((r, i) => { const isObj = r && typeof r === 'object'; const t = isObj ? (r.recommendation || '') : String(r || ''); const d = isObj && r.date ? ` (${formatDate(r.date)})` : ''; return <Text key={i} style={styles.listItem}>{i + 1}. {t}{d}</Text>; })}</View>)}

              {record.notes && (<View style={styles.fieldContainer} wrap={notesRows > 8 ? undefined : false}><Text style={styles.sectionTitle}>Notes</Text><Text style={styles.listItem}>{record.notes}</Text></View>)}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default BirthPlanDocumentPDFTemplate;
