/**
 * CancerDiagnosisDocumentPDFTemplate.jsx
 * Helvetica 20/14/12pt
 * Collection: cancer_diagnosis
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
  subLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#333333', marginTop: 4, marginBottom: 2, paddingLeft: 12 },
  nested: { paddingLeft: 12, borderLeftWidth: 1, borderLeftColor: '#cccccc', marginBottom: 2 },
  recDate: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#333333', marginTop: 4, marginBottom: 2, paddingLeft: 4 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#666666' },
});

const humanizeKey = (key) => { if (key === null || key === undefined || key === '') return ''; const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2'); return s.charAt(0).toUpperCase() + s.slice(1); };
const isEmptyDeep = (v) => {
  if (v === null || v === undefined) return true;
  if (typeof v === 'boolean') return false;
  if (typeof v === 'number') return !Number.isFinite(v);
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0;
  if (typeof v === 'object') return Object.values(v).every(isEmptyDeep);
  return false;
};
const isScalar = (v) => v === null || typeof v !== 'object';
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };

/* recursive object node: label = bold heading; value = plain line below */
const renderObjectNode = (label, value, keyPath, depth) => {
  if (isEmptyDeep(value)) return null;
  const LabelTag = depth > 1 ? styles.subLabel : styles.subSectionTitle;
  if (isScalar(value)) {
    return (
      <View key={keyPath}>
        {label ? <Text style={LabelTag}>{label}</Text> : null}
        <Text style={styles.listItem}>{fmtScalar(value)}</Text>
      </View>
    );
  }
  const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
  if (entries.length === 0) return null;
  return (
    <View key={keyPath}>
      {label ? <Text style={LabelTag}>{label}</Text> : null}
      <View style={label ? styles.nested : undefined}>{entries.map(([k, v]) => renderObjectNode(humanizeKey(k), v, `${keyPath}-${k}`, depth + 1))}</View>
    </View>
  );
};

/* count leaf rows for the Rule #74 wrap heuristic */
const countRows = (val) => {
  if (isEmptyDeep(val)) return 0;
  if (isScalar(val)) return 1;
  if (Array.isArray(val)) { let n = 0; val.filter(x => !isEmptyDeep(x)).forEach(it => { n += isScalar(it) ? 1 : 1 + countRows(it); }); return n; }
  let n = 0; Object.values(val).forEach(sub => { if (!isEmptyDeep(sub)) n += isScalar(sub) ? 2 : 1 + countRows(sub); }); return n;
};

const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
const splitBySentence = (text) => { if (!text) return []; return String(text).split(/[;.]\s+/).map(s => s.trim()).filter(s => s.length > 0 && s.replace(/[.!?;,]+/g, '').trim().length > 0); };

const FL = {
  primarySite: 'Primary Site', histology: 'Histology', grade: 'Grade',
  tumorSize: 'Tumor Size', lymphNodeStatus: 'Lymph Node Status',
  methodOfDiagnosis: 'Method of Diagnosis', surgicalClipsPlaced: 'Surgical Clips Placed',
  provider: 'Provider', facility: 'Facility', status: 'Status',
};

const renderFieldGroup = (title, fields, record) => {
  const visible = fields.filter(f => hasVal(record[f]));
  if (visible.length === 0) return null;
  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {visible.map((f, i) => (
        <View key={i}>
          <Text style={styles.subSectionTitle}>{FL[f] || f}</Text>
          <Text style={styles.listItem}>{fmtVal(record[f])}</Text>
        </View>
      ))}
    </View>
  );
};

const CancerDiagnosisDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.cancer_diagnosis) return Array.isArray(r.cancer_diagnosis) ? r.cancer_diagnosis : [r.cancer_diagnosis];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.cancer_diagnosis) return Array.isArray(dd.cancer_diagnosis) ? dd.cancer_diagnosis : [dd.cancer_diagnosis]; return [dd]; }
      return r;
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) return <Document><Page size="A4" style={styles.page}><Text style={styles.documentTitle}>Cancer Diagnosis</Text><Text style={styles.emptyState}>No records available</Text></Page></Document>;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.documentTitle}>Cancer Diagnosis</Text>
        {records.map((record, idx) => {
          const biomarkers = Array.isArray(record.biomarkers) ? record.biomarkers.filter(b => b?.name) : [];
          const mutations = Array.isArray(record.geneticMutations) ? record.geneticMutations.filter(Boolean) : [];
          return (
            <View key={idx} style={styles.recordSection}>
              <View wrap={false}>
                <Text style={styles.recordTitle}>{`Cancer Diagnosis ${idx + 1}`}</Text>
                {record.date && <Text style={styles.recordMeta}>{formatDate(record.date)}</Text>}
                {record.primarySite && <Text style={styles.recordMeta}>{record.primarySite}</Text>}
              </View>

              {renderFieldGroup('Tumor Information', ['primarySite', 'histology', 'grade', 'tumorSize', 'lymphNodeStatus'], record)}

              {(record.dateOfDiagnosis || hasVal(record.methodOfDiagnosis)) && (
                <View style={styles.fieldContainer}>
                  <Text style={styles.sectionTitle}>Diagnosis Details</Text>
                  {record.dateOfDiagnosis && <><Text style={styles.subSectionTitle}>Date of Diagnosis</Text><Text style={styles.listItem}>{formatDate(record.dateOfDiagnosis)}</Text></>}
                  {hasVal(record.methodOfDiagnosis) && <><Text style={styles.subSectionTitle}>Method of Diagnosis</Text><Text style={styles.listItem}>{record.methodOfDiagnosis}</Text></>}
                </View>
              )}

              {biomarkers.length > 0 && (
                <View style={styles.fieldContainer}>
                  <Text style={styles.sectionTitle}>Biomarkers</Text>
                  {biomarkers.map((b, i) => (
                    <Text key={i} style={styles.listItem}>{i + 1}. {b.name}: {b.value || b.status || ''}{b.variant ? ` - ${b.variant}` : ''}{b.classification ? ` (${b.classification})` : ''}{b.type ? ` [${b.type}]` : ''}</Text>
                  ))}
                </View>
              )}

              {record.immunohistochemistry && typeof record.immunohistochemistry === 'object' && !Array.isArray(record.immunohistochemistry) && Object.entries(record.immunohistochemistry).filter(([k, v]) => k && hasVal(v)).length > 0 && (
                <View style={styles.fieldContainer} wrap={false}>
                  <Text style={styles.sectionTitle}>Immunohistochemistry</Text>
                  {Object.entries(record.immunohistochemistry).filter(([k, v]) => k && hasVal(v)).map(([k, v], i) => (
                    <Text key={i} style={styles.listItem}>{i + 1}. {k}: {String(v)}</Text>
                  ))}
                </View>
              )}

              {mutations.length > 0 && (
                <View style={styles.fieldContainer}>
                  <Text style={styles.sectionTitle}>Genetic Mutations</Text>
                  {mutations.map((m, i) => <Text key={i} style={styles.listItem}>{i + 1}. {m}</Text>)}
                </View>
              )}

              {(hasVal(record.surgicalClipsPlaced) || hasVal(record.chemotherapyDecision)) && (
                <View style={styles.fieldContainer}>
                  <Text style={styles.sectionTitle}>Treatment Decision</Text>
                  {hasVal(record.surgicalClipsPlaced) && <><Text style={styles.subSectionTitle}>Surgical Clips Placed</Text><Text style={styles.listItem}>{fmtVal(record.surgicalClipsPlaced)}</Text></>}
                  {hasVal(record.chemotherapyDecision) && <><Text style={styles.subSectionTitle}>Chemotherapy Decision</Text>{splitBySentence(fmtVal(record.chemotherapyDecision)).map((s, i) => <Text key={i} style={styles.listItem}>{i + 1}. {s}</Text>)}</>}
                </View>
              )}

              {hasVal(record.findings) && (
                <View style={styles.fieldContainer}>
                  <Text style={styles.sectionTitle}>Findings</Text>
                  {splitBySentence(fmtVal(record.findings)).map((s, i) => <Text key={i} style={styles.listItem}>{i + 1}. {s}</Text>)}
                </View>
              )}

              {hasVal(record.assessment) && (
                <View style={styles.fieldContainer}>
                  <Text style={styles.sectionTitle}>Clinical Assessment</Text>
                  {splitBySentence(fmtVal(record.assessment)).map((s, i) => <Text key={i} style={styles.listItem}>{i + 1}. {s}</Text>)}
                </View>
              )}

              {hasVal(record.plan) && (
                <View style={styles.fieldContainer}>
                  <Text style={styles.sectionTitle}>Plan</Text>
                  {splitBySentence(fmtVal(record.plan)).map((s, i) => <Text key={i} style={styles.listItem}>{i + 1}. {s}</Text>)}
                </View>
              )}

              {(() => {
                const recs = Array.isArray(record.recommendations) ? record.recommendations.filter(r => r && (typeof r === 'string' || hasVal(r.recommendation) || hasVal(r.text) || hasVal(r.date))) : [];
                if (recs.length === 0) return null;
                const textOf = (r) => typeof r === 'string' ? r : (r.recommendation || r.text || '');
                const groups = [];
                recs.forEach((r) => { const d = (typeof r === 'string' ? '' : (r?.date || '')).trim(); const last = groups[groups.length - 1]; if (last && last.date === d) last.items.push(r); else groups.push({ date: d, items: [r] }); });
                return (
                  <View style={styles.fieldContainer} wrap={recs.length > 8 ? undefined : false}>
                    <Text style={styles.sectionTitle}>Recommendations</Text>
                    {groups.map((group, gIdx) => (
                      <View key={gIdx}>
                        {group.date ? <Text style={styles.recDate}>{group.date}</Text> : null}
                        {group.items.map((r, i) => (<Text key={i} style={styles.listItem}>{i + 1}. {textOf(r).trim()}</Text>))}
                      </View>
                    ))}
                  </View>
                );
              })()}

              {record.results && typeof record.results === 'object' && !Array.isArray(record.results) && !isEmptyDeep(record.results) && (() => {
                const entries = Object.entries(record.results).filter(([, v]) => !isEmptyDeep(v));
                if (entries.length === 0) return null;
                return entries.map(([k, v], i) => {
                  const rows = countRows(v);
                  return (
                    <View key={`results-${k}`} style={styles.fieldContainer} wrap={rows > 8 ? undefined : false}>
                      {i === 0 ? <Text style={styles.sectionTitle}>Results</Text> : null}
                      {renderObjectNode(humanizeKey(k), v, `results-${k}`, 1)}
                    </View>
                  );
                });
              })()}

              {renderFieldGroup('Provider Information', ['provider', 'facility', 'status'], record)}

              {hasVal(record.notes) && (
                <View style={styles.fieldContainer}>
                  <Text style={styles.sectionTitle}>Notes</Text>
                  {splitBySentence(fmtVal(record.notes)).map((s, i) => <Text key={i} style={styles.listItem}>{i + 1}. {s}</Text>)}
                </View>
              )}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default CancerDiagnosisDocumentPDFTemplate;
