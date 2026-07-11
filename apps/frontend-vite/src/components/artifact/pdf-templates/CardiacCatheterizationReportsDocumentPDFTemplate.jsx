/**
 * CardiacCatheterizationReportsDocumentPDFTemplate.jsx
 * Helvetica 20/14/12pt
 * Collection: cardiac_catheterization_reports
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
const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
const splitBySentence = (text) => { if (!text) return []; return String(text).split(/[;.]\s+/).map(s => s.trim()).filter(s => s.length > 0 && s.replace(/[.!?;,]+/g, '').trim().length > 0); };

/* Recursively render a dynamic-key object value (handles nested objects like findings.LAD / findings.RCA). */
const renderPdfObjectValue = (v, keyBase, depth) => {
  if (Array.isArray(v)) {
    return v.filter(hasVal).map((item, i) => renderPdfObjectValue(item, `${keyBase}-${i}`, depth));
  }
  if (v && typeof v === 'object') {
    return Object.entries(v).filter(([, sv]) => hasVal(sv)).map(([sk, sv], i) => (
      <View key={`${keyBase}-${sk}-${i}`}>
        <Text style={[styles.subSectionTitle, depth > 0 ? { paddingLeft: 4 + depth * 10, fontSize: 11 } : null]}>{sk}</Text>
        {renderPdfObjectValue(sv, `${keyBase}-${sk}`, depth + 1)}
      </View>
    ));
  }
  return <Text style={[styles.listItem, depth > 1 ? { paddingLeft: 12 + (depth - 1) * 10 } : null]}>{fmtVal(v)}</Text>;
};

const CardiacCatheterizationReportsDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.cardiac_catheterization_reports) return Array.isArray(r.cardiac_catheterization_reports) ? r.cardiac_catheterization_reports : [r.cardiac_catheterization_reports];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.cardiac_catheterization_reports) return Array.isArray(dd.cardiac_catheterization_reports) ? dd.cardiac_catheterization_reports : [dd.cardiac_catheterization_reports]; return [dd]; }
      return r;
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) return <Document><Page size="A4" style={styles.page}><Text style={styles.documentTitle}>Cardiac Catheterization Reports</Text><Text style={styles.emptyState}>No records available</Text></Page></Document>;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.documentTitle}>Cardiac Catheterization Reports</Text>
        {records.map((record, idx) => {
          const interventions = Array.isArray(record.interventions) ? record.interventions.filter(Boolean) : [];
          const complications = Array.isArray(record.complications) ? record.complications.filter(Boolean) : [];
          const findingsEntries = record.findings && typeof record.findings === 'object' ? Object.entries(record.findings).filter(([_, v]) => hasVal(v)) : [];
          const coronaryEntries = record.coronaryAnatomy && typeof record.coronaryAnatomy === 'object' ? Object.entries(record.coronaryAnatomy).filter(([_, v]) => hasVal(v)) : [];
          const hemoEntries = record.hemodynamics && typeof record.hemodynamics === 'object' ? Object.entries(record.hemodynamics).filter(([_, v]) => hasVal(v)) : [];
          return (
            <View key={idx} style={styles.recordSection}>
              <View wrap={false}><Text style={styles.recordTitle}>{`Cardiac Catheterization Report ${idx + 1}`}</Text>{record.date && <Text style={styles.recordMeta}>{formatDate(record.date)}</Text>}</View>

              {hasVal(record.indication) && (<View style={styles.fieldContainer}><Text style={styles.sectionTitle}>Indication</Text>{splitBySentence(fmtVal(record.indication)).map((s, i) => <Text key={i} style={styles.listItem}>{i + 1}. {s}</Text>)}</View>)}
              {hasVal(record.accessSite) && (<View style={styles.fieldContainer}><Text style={styles.subSectionTitle}>Access Site</Text><Text style={styles.listItem}>{record.accessSite}</Text></View>)}

              {findingsEntries.length > 0 && (<View style={styles.fieldContainer} wrap={findingsEntries.length > 8 ? undefined : false}><Text style={styles.sectionTitle}>Findings</Text>{findingsEntries.map(([k, v], i) => <View key={i}><Text style={styles.subSectionTitle}>{k}</Text>{renderPdfObjectValue(v, `find-${i}`, 0)}</View>)}</View>)}
              {coronaryEntries.length > 0 && (<View style={styles.fieldContainer} wrap={coronaryEntries.length > 8 ? undefined : false}><Text style={styles.sectionTitle}>Coronary Anatomy</Text>{coronaryEntries.map(([k, v], i) => <View key={i}><Text style={styles.subSectionTitle}>{k}</Text>{renderPdfObjectValue(v, `cor-${i}`, 0)}</View>)}</View>)}
              {hemoEntries.length > 0 && (<View style={styles.fieldContainer} wrap={hemoEntries.length > 8 ? undefined : false}><Text style={styles.sectionTitle}>Hemodynamics</Text>{hemoEntries.map(([k, v], i) => <View key={i}><Text style={styles.subSectionTitle}>{k}</Text>{renderPdfObjectValue(v, `hemo-${i}`, 0)}</View>)}</View>)}

              {interventions.length > 0 && (<View style={styles.fieldContainer}><Text style={styles.sectionTitle}>Interventions</Text>{interventions.map((it, i) => <Text key={i} style={styles.listItem}>{i + 1}. {it}</Text>)}</View>)}
              {complications.length > 0 && (<View style={styles.fieldContainer}><Text style={styles.sectionTitle}>Complications</Text>{complications.map((it, i) => <Text key={i} style={styles.listItem}>{i + 1}. {it}</Text>)}</View>)}

              {hasVal(record.recommendations) && (<View style={styles.fieldContainer}><Text style={styles.sectionTitle}>Recommendations</Text>{splitBySentence(fmtVal(record.recommendations)).map((s, i) => <Text key={i} style={styles.listItem}>{i + 1}. {s}</Text>)}</View>)}
              {hasVal(record.cardiologist) && (<View style={styles.fieldContainer}><Text style={styles.subSectionTitle}>Cardiologist</Text><Text style={styles.listItem}>{record.cardiologist}</Text></View>)}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default CardiacCatheterizationReportsDocumentPDFTemplate;
