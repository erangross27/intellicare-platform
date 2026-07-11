/**
 * BoneMarrowStudiesDocumentPDFTemplate.jsx
 * Helvetica 20/14/12pt, numbered items, conditional wrap
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
const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'number') return v !== 0; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; return true; };
const fmtVal = (v) => { if (typeof v === 'number') return String(v); return String(v || ''); };
/* Abbreviation-safe sentence split + label:value parse — mirrors the JSX template (segmentation parity). */
const ABBR_RE = '(?:Mr|Mrs|Ms|Dr|Prof|Rev|Sr|Jr|St|Gen|Col|Sgt|Lt|Capt|vs|etc)';
const splitBySentence = (text) => { if (!text) return []; return String(text).split(new RegExp(`(?<!\\b${ABBR_RE}\\.)(?<=[.!?])\\s+`)).map(s => s.trim()).filter(s => s.length > 0 && s.replace(/[.!?;,]+/g, '').trim().length > 0); };
/* PAREN-AWARE: only a colon at paren-depth 0 counts (ratios inside parens like "(Kappa:Lambda 15:1)" are NOT labels). */
const parseLabel = (s) => { const str = String(s ?? ''); let depth = 0; for (let i = 0; i < str.length; i++) { const c = str[i]; if (c === '(' || c === '[') depth++; else if (c === ')' || c === ']') depth = Math.max(0, depth - 1); else if (c === ':' && depth === 0) { const label = str.slice(0, i); const m = str.slice(i + 1).match(/^(\s+)(\S[\s\S]*)$/); if (m && label.trim().length >= 1 && label.length <= 80) return { isLabeled: true, label: label.trim(), value: m[2] }; return { isLabeled: false, label: '', value: str }; } } return { isLabeled: false, label: '', value: str }; };
const FIELD_LABELS = { procedureType: 'Procedure Type', aspirationSite: 'Aspiration Site', indicationForStudy: 'Indication', coreBiopsyLength: 'Core Biopsy Length', specimenAdequacy: 'Specimen Adequacy', cellularity: 'Cellularity', blastPercentage: 'Blast %', myeloidToErythroidRatio: 'M:E Ratio', erythroidSeries: 'Erythroid Series', myeloidSeries: 'Myeloid Series', megakaryocytes: 'Megakaryocytes', ironStores: 'Iron Stores', ringedSideroblasts: 'Ringed Sideroblasts', fibrosis: 'Fibrosis', previousStudyDate: 'Previous Study Date', provider: 'Provider', facility: 'Facility' };

const renderFieldGroup = (title, fields, record) => {
  const visible = fields.filter(f => hasVal(record[f]));
  if (visible.length === 0) return null;
  return (<View style={styles.fieldContainer} wrap={false}><Text style={styles.sectionTitle}>{title}</Text>{visible.map((f, i) => (<View key={i}><Text style={styles.subSectionTitle}>{FIELD_LABELS[f] || f}</Text><Text style={styles.listItem}>{fmtVal(record[f])}</Text></View>))}</View>);
};

const BoneMarrowStudiesDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => { if (r?.bone_marrow_studies) return Array.isArray(r.bone_marrow_studies) ? r.bone_marrow_studies : [r.bone_marrow_studies]; if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.bone_marrow_studies) return Array.isArray(dd.bone_marrow_studies) ? dd.bone_marrow_studies : [dd.bone_marrow_studies]; return [dd]; } return r; });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) return <Document><Page size="A4" style={styles.page}><Text style={styles.documentTitle}>Bone Marrow Studies</Text><Text style={styles.emptyState}>No records available</Text></Page></Document>;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.documentTitle}>Bone Marrow Studies</Text>
        {records.map((record, idx) => {
          const specialStains = Array.isArray(record.specialStains) ? record.specialStains.filter(Boolean) : [];
          const molecularStudies = Array.isArray(record.molecularStudies) ? record.molecularStudies.filter(Boolean) : [];
          const dysplasticChanges = Array.isArray(record.dysplasticChanges) ? record.dysplasticChanges.filter(Boolean) : [];
          const complications = Array.isArray(record.complications) ? record.complications.filter(Boolean) : [];
          return (
            <View key={idx} style={styles.recordSection}>
              <View wrap={false}><Text style={styles.recordTitle}>{`Bone Marrow Study ${idx + 1}`}</Text>{(record.studyDate || record.date) && <Text style={styles.recordMeta}>{formatDate(record.studyDate || record.date)}</Text>}</View>

              {renderFieldGroup('Procedure Information', ['procedureType', 'aspirationSite', 'indicationForStudy', 'coreBiopsyLength', 'specimenAdequacy'], record)}
              {renderFieldGroup('Cellularity', ['cellularity', 'blastPercentage', 'myeloidToErythroidRatio'], record)}
              {renderFieldGroup('Cell Lines', ['erythroidSeries', 'myeloidSeries', 'megakaryocytes'], record)}
              {renderFieldGroup('Iron Studies', ['ironStores', 'ringedSideroblasts'], record)}

              {hasVal(record.flowCytometryFindings) && (() => { const fcSents = splitBySentence(record.flowCytometryFindings).map(s => s.replace(/\.$/, '')); const fcLabeled = fcSents.some(s => parseLabel(s).isLabeled); return (<View style={styles.fieldContainer} wrap={fcSents.length > 8 ? undefined : false}><Text style={styles.sectionTitle}>Flow Cytometry</Text>{fcSents.map((s, i) => { const p = parseLabel(s); return p.isLabeled ? (<View key={i}><Text style={styles.subSectionTitle}>{p.label}</Text><Text style={styles.listItem}>{p.value}</Text></View>) : (<Text key={i} style={styles.listItem}>{fcLabeled ? s : `${i + 1}. ${s}`}</Text>); })}</View>); })()}
              {hasVal(record.cytogeneticResults) && (<View style={styles.fieldContainer} wrap={false}><Text style={styles.sectionTitle}>Cytogenetics</Text><Text style={styles.listItem}>{record.cytogeneticResults}</Text></View>)}
              {molecularStudies.length > 0 && (<View style={styles.fieldContainer} wrap={false}><Text style={styles.sectionTitle}>Molecular Studies</Text>{molecularStudies.map((item, i) => <Text key={i} style={styles.listItem}>{i + 1}. {item}</Text>)}</View>)}
              {specialStains.length > 0 && (<View style={styles.fieldContainer} wrap={false}><Text style={styles.sectionTitle}>Special Stains</Text>{specialStains.map((item, i) => { const p = parseLabel(String(item)); return p.isLabeled ? (<View key={i}><Text style={styles.subSectionTitle}>{p.label}</Text><Text style={styles.listItem}>{p.value}</Text></View>) : (<Text key={i} style={styles.listItem}>{i + 1}. {item}</Text>); })}</View>)}
              {hasVal(record.pathologicDiagnosis) && (<View style={styles.fieldContainer} wrap={false}><Text style={styles.sectionTitle}>Pathologic Diagnosis</Text><Text style={styles.listItem}>{record.pathologicDiagnosis}</Text></View>)}
              {(dysplasticChanges.length > 0 || hasVal(record.fibrosis)) && (<View style={styles.fieldContainer} wrap={false}><Text style={styles.sectionTitle}>Morphology</Text>{dysplasticChanges.map((item, i) => <Text key={i} style={styles.listItem}>{i + 1}. {item}</Text>)}{hasVal(record.fibrosis) && <><Text style={styles.subSectionTitle}>Fibrosis</Text><Text style={styles.listItem}>{record.fibrosis}</Text></>}</View>)}
              {complications.length > 0 && (<View style={styles.fieldContainer} wrap={false}><Text style={styles.sectionTitle}>Complications</Text>{complications.map((item, i) => <Text key={i} style={styles.listItem}>{i + 1}. {item}</Text>)}</View>)}
              {hasVal(record.previousStudyDate) && (<View style={styles.fieldContainer} wrap={false}><Text style={styles.sectionTitle}>Comparison</Text><Text style={styles.subSectionTitle}>{FIELD_LABELS.previousStudyDate}</Text><Text style={styles.listItem}>{formatDate(record.previousStudyDate)}</Text></View>)}
              {renderFieldGroup('Provider Information', ['provider', 'facility'], record)}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default BoneMarrowStudiesDocumentPDFTemplate;
