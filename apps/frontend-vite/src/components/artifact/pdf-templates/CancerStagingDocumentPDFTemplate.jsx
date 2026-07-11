/**
 * CancerStagingDocumentPDFTemplate.jsx
 * Helvetica 20/14/12pt
 * Collection: cancer_staging
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
  nested: { marginLeft: 10, paddingLeft: 8, borderLeftWidth: 1, borderLeftColor: '#000000', marginTop: 2 },
  recDate: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, paddingLeft: 4 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#666666' },
});

const KEY_OVERRIDES = { ipiScore: 'IPI Score', IPIScore: 'IPI Score', ldh: 'LDH', cns: 'CNS', cnsRiskAssessment: 'CNS Risk Assessment', ecog: 'ECOG' };
const humanizeKey = (key) => { if (key === null || key === undefined || key === '') return ''; if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key]; const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2'); return s.charAt(0).toUpperCase() + s.slice(1); };
const isEmptyDeep = (v) => { if (v === null || v === undefined) return true; if (typeof v === 'boolean') return false; if (typeof v === 'number') return !Number.isFinite(v); if (typeof v === 'string') return v.trim() === ''; if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0; if (typeof v === 'object') return Object.values(v).every(isEmptyDeep); return false; };
const isScalar = (v) => v === null || typeof v !== 'object';
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
const countRows = (val) => { if (isEmptyDeep(val)) return 0; if (isScalar(val)) return 1; if (Array.isArray(val)) { let n = 0; val.filter(x => !isEmptyDeep(x)).forEach(it => { n += isScalar(it) ? 1 : 1 + countRows(it); }); return n; } let n = 0; Object.values(val).forEach(sub => { if (!isEmptyDeep(sub)) n += isScalar(sub) ? 2 : 1 + countRows(sub); }); return n; };

/* recursive object node — label = bold heading; value = plain line below */
const renderObjectNode = (label, value, keyPath, depth) => {
  if (isEmptyDeep(value)) return null;
  if (isScalar(value)) {
    return (
      <View key={keyPath}>
        {label ? <Text style={styles.subSectionTitle}>{label}</Text> : null}
        <Text style={styles.listItem}>{fmtScalar(value)}</Text>
      </View>
    );
  }
  const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
  if (entries.length === 0) return null;
  return (
    <View key={keyPath}>
      {label ? <Text style={styles.subSectionTitle}>{label}</Text> : null}
      <View style={label ? styles.nested : undefined}>{entries.map(([k, v]) => renderObjectNode(humanizeKey(k), v, `${keyPath}-${k}`, depth + 1))}</View>
    </View>
  );
};

const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
const splitBySentence = (text) => { if (!text) return []; return String(text).split(/[;.]\s+/).map(s => s.trim()).filter(s => s.length > 0 && s.replace(/[.!?;,]+/g, '').trim().length > 0); };

const FL = {
  issStaging: 'ISS Staging', rissStaging: 'R-ISS Staging', durieSalmon: 'Durie-Salmon',
  annArbor: 'Ann Arbor', figo: 'FIGO', provider: 'Provider', facility: 'Facility', status: 'Status',
};

const CancerStagingDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.cancer_staging) return Array.isArray(r.cancer_staging) ? r.cancer_staging : [r.cancer_staging];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.cancer_staging) return Array.isArray(dd.cancer_staging) ? dd.cancer_staging : [dd.cancer_staging]; return [dd]; }
      return r;
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) return <Document><Page size="A4" style={styles.page}><Text style={styles.documentTitle}>Cancer Staging</Text><Text style={styles.emptyState}>No records available</Text></Page></Document>;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.documentTitle}>Cancer Staging</Text>
        {records.map((record, idx) => {
          const tnm = record.tnmStaging || {};
          const otherFs = ['issStaging', 'rissStaging', 'durieSalmon', 'annArbor', 'figo'].filter(f => hasVal(record[f]));
          return (
            <View key={idx} style={styles.recordSection}>
              <View wrap={false}>
                <Text style={styles.recordTitle}>{`Cancer Staging ${idx + 1}`}</Text>
                {record.date && <Text style={styles.recordMeta}>{formatDate(record.date)}</Text>}
                {tnm.overallStage && <Text style={styles.recordMeta}>{tnm.overallStage}</Text>}
              </View>

              {(hasVal(tnm.overallStage) || hasVal(tnm.t) || hasVal(tnm.n) || hasVal(tnm.m)) && (
                <View style={styles.fieldContainer}>
                  <Text style={styles.sectionTitle}>TNM Staging</Text>
                  {hasVal(tnm.overallStage) && <><Text style={styles.subSectionTitle}>Overall Stage</Text><Text style={styles.listItem}>{tnm.overallStage}</Text></>}
                  {hasVal(tnm.t) && <><Text style={styles.subSectionTitle}>T (Tumor)</Text><Text style={styles.listItem}>{tnm.t}</Text></>}
                  {hasVal(tnm.n) && <><Text style={styles.subSectionTitle}>N (Nodes)</Text><Text style={styles.listItem}>{tnm.n}</Text></>}
                  {hasVal(tnm.m) && <><Text style={styles.subSectionTitle}>M (Metastasis)</Text><Text style={styles.listItem}>{tnm.m}</Text></>}
                </View>
              )}

              {(otherFs.length > 0 || (hasVal(record.otherStaging) && !isScalar(record.otherStaging))) && (
                <View style={styles.fieldContainer} wrap={(otherFs.length + countRows(record.otherStaging)) > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Other Staging Systems</Text>
                  {otherFs.map((f, i) => <View key={i}><Text style={styles.subSectionTitle}>{FL[f]}</Text><Text style={styles.listItem}>{fmtVal(record[f])}</Text></View>)}
                  {hasVal(record.otherStaging) && !isScalar(record.otherStaging) && Object.entries(record.otherStaging).filter(([, v]) => !isEmptyDeep(v)).map(([k, v]) => renderObjectNode(humanizeKey(k), v, `otherStaging-${k}`, 1))}
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

              {hasVal(record.results) && !isScalar(record.results) && Object.entries(record.results).filter(([, v]) => !isEmptyDeep(v)).length > 0 && (
                <View style={styles.fieldContainer} wrap={countRows(record.results) > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Results</Text>
                  {Object.entries(record.results).filter(([, v]) => !isEmptyDeep(v)).map(([k, v]) => renderObjectNode(humanizeKey(k), v, `results-${k}`, 1))}
                </View>
              )}

              {Array.isArray(record.recommendations) && record.recommendations.filter(r => !isEmptyDeep(r)).length > 0 && (() => {
                const recs = record.recommendations.filter(r => !isEmptyDeep(r));
                const groups = [];
                recs.forEach((r) => { const d = (r?.date || '').trim(); const last = groups[groups.length - 1]; if (last && last.date === d) last.items.push(r); else groups.push({ date: d, items: [r] }); });
                return (
                  <View style={styles.fieldContainer} wrap={recs.length > 8 ? undefined : false}>
                    <Text style={styles.sectionTitle}>Recommendations</Text>
                    {groups.map((group, gIdx) => (
                      <View key={gIdx}>
                        {group.date ? <Text style={styles.recDate}>{group.date}</Text> : null}
                        {group.items.map((r, i) => <Text key={i} style={styles.listItem}>{i + 1}. {(r?.recommendation || '').trim()}</Text>)}
                      </View>
                    ))}
                  </View>
                );
              })()}

              {(hasVal(record.provider) || hasVal(record.facility)) && (
                <View style={styles.fieldContainer}>
                  <Text style={styles.sectionTitle}>Provider Information</Text>
                  {['provider', 'facility', 'status'].filter(f => hasVal(record[f])).map((f, i) => <View key={i}><Text style={styles.subSectionTitle}>{FL[f]}</Text><Text style={styles.listItem}>{fmtVal(record[f])}</Text></View>)}
                </View>
              )}

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

export default CancerStagingDocumentPDFTemplate;
