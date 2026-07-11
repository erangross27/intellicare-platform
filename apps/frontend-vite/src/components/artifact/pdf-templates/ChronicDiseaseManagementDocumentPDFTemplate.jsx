/**
 * ChronicDiseaseManagementDocumentPDFTemplate.jsx
 * Box-free line-based layout (ConsultationNotes donor) — LETTER size — B&W.
 * react-pdf 4.5.1 engine rules: wrap props are BOOLEANS (explicit undefined = unbreakable);
 * recordContainer uses paddingBottom only (marginBottom → empty page 1); section title inside the first
 * field's View + leaf glue (anti-orphan, 6a2d6af6). Narrative fields split by sentence then guarded comma
 * (parseLabeledSentences — labeled sentences become sub-label groups); disease objects render each key as
 * a sub-label with numbered rows (arrays like medications = one row per item, never a comma blob).
 * Collection: chronic_disease_management
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
  recordMeta: { fontSize: 12, color: '#333333', marginTop: 4 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', textTransform: 'uppercase', letterSpacing: 0.5, borderBottomWidth: 1, borderBottomColor: '#000000', paddingBottom: 3, marginBottom: 8 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#000000', borderBottomWidth: 0.5, borderBottomColor: '#999999', paddingBottom: 3, marginBottom: 4 },
  subLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 3, marginBottom: 2 },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 3, paddingLeft: 8 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#666666' },
});

const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).some(k => hasVal(v[k])); return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
const safeArr = (v) => Array.isArray(v) ? v.filter(Boolean) : [];
const isScalar = (v) => v === null || typeof v !== 'object';
const isEmptyDeep = (v) => { if (v === null || v === undefined) return true; if (typeof v === 'boolean') return false; if (typeof v === 'number') return !Number.isFinite(v); if (typeof v === 'string') return v.trim() === ''; if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0; if (typeof v === 'object') return Object.values(v).every(isEmptyDeep); return false; };
const humanizeKey = (key) => { if (key === null || key === undefined || key === '') return ''; const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2'); return s.charAt(0).toUpperCase() + s.slice(1); };
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|approx|no|No|i\.e|e\.g))[;.](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); };
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) {
      if (!/\s/.test(text[i + 1] || '')) { current += ch; continue; }
      const rest = text.slice(i + 1).replace(/^\s+/, '');
      if (/^(and|or)\b/i.test(rest)) { current += ch; continue; }
      if (/\b(and|or)\s*$/i.test(current)) { current += ch; continue; }
      const t = current.trim(); if (t) result.push(t); current = '';
    }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};
const parseLabeledSentences = (text) => {
  const groups = []; let nullGroup = null;
  splitBySentence(String(text || '')).forEach(sentence => {
    const ci = sentence.indexOf(':');
    const label = ci > 0 && ci < 60 && !sentence.substring(0, ci).includes('.') ? sentence.substring(0, ci).trim() : null;
    if (label) { groups.push({ label, items: splitByComma(sentence.substring(ci + 1).trim()).map(p => p.replace(/[.;]+$/, '').trim()).filter(Boolean) }); nullGroup = null; }
    else { if (!nullGroup) { nullGroup = { label: null, items: [] }; groups.push(nullGroup); } splitByComma(sentence).forEach(p => { const t = p.replace(/[.;]+$/, '').trim(); if (t) nullGroup.items.push(t); }); }
  });
  return groups;
};

const FL = {
  provider: 'Provider', facility: 'Facility', managedBy: 'Managed By', status: 'Status',
  findings: 'Findings', assessment: 'Assessment', plan: 'Plan', notes: 'Notes', results: 'Results',
};
const DISEASE_FIELDS = ['diabetes', 'hypertension', 'hyperlipidemia', 'asthma', 'copd', 'arthritis'];
const DISEASE_PROP_LABELS = { status: 'Status', control: 'Control', contributesToCHA2DS2VASc: 'CHA2DS2-VASc Contributor' };

const blockRows = (value) => { const g = parseLabeledSentences(String(value)); return g.reduce((s, gr) => s + gr.items.length + (gr.label ? 1 : 0), 0); };

// Narrative field as a wrap-gated unit; section title rides inside when isFirst. A single narrative
// field + its title fits one page → wrap={false} up to ~22 rows (avoids the title-orphan).
const renderNarrative = (sTitle, value) => {
  if (!hasVal(value)) return null;
  const groups = parseLabeledSentences(String(value));
  if (groups.length === 0) return null;
  const rows = blockRows(value) + 1;
  let n = 0;
  return (
    <View style={styles.section} wrap={rows > 22 ? true : false}>
      <Text style={styles.sectionTitle}>{sTitle}</Text>
      {groups.map((g, gi) => {
        if (g.label) n = 0;
        const start = n; n += g.items.length;
        return (
          <View key={gi}>
            {g.label && <Text style={styles.subLabel}>{g.label}</Text>}
            {g.items.map((it, i) => <Text key={i} style={styles.listItem}>{start + i + 1}. {it}</Text>)}
          </View>
        );
      })}
    </View>
  );
};

const renderArraySection = (sTitle, items) => {
  const arr = safeArr(items);
  if (arr.length === 0) return null;
  return (
    <View style={styles.section} wrap={arr.length + 1 > 8 ? true : false}>
      <Text style={styles.sectionTitle}>{sTitle}</Text>
      {arr.map((it, i) => <Text key={i} style={styles.listItem}>{i + 1}. {it}</Text>)}
    </View>
  );
};

const ChronicDiseaseManagementDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.chronic_disease_management) return Array.isArray(r.chronic_disease_management) ? r.chronic_disease_management : [r.chronic_disease_management];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.chronic_disease_management) return Array.isArray(dd.chronic_disease_management) ? dd.chronic_disease_management : [dd.chronic_disease_management]; return [dd]; }
      return r;
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (<Document><Page size="LETTER" style={styles.page}><View style={styles.documentHeader}><Text style={styles.title}>Chronic Disease Management</Text></View><Text style={styles.emptyState}>No records available</Text></Page></Document>);
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Chronic Disease Management</Text></View>
        {records.map((record, idx) => (
          // Rule #75: every record after the first STARTS ON A NEW PAGE (break = page-break-before);
          // never on record 0 (would leave a blank first page).
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`Chronic Disease Management ${idx + 1}`}</Text>
              {(record.date || record.assessmentDate) && <Text style={styles.recordMeta}>{formatDate(record.date || record.assessmentDate)}</Text>}
            </View>

            {/* Provider */}
            {['provider', 'facility', 'managedBy', 'status'].some(f => hasVal(record[f])) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Provider</Text>
                {['provider', 'facility', 'managedBy', 'status'].map(f => hasVal(record[f]) ? (
                  <View key={f} style={{ marginBottom: 4 }}><Text style={styles.fieldLabel}>{FL[f] || f}</Text><Text style={styles.listItem}>1. {fmtVal(record[f])}</Text></View>
                ) : null)}
              </View>
            )}

            {/* Chronic Conditions — each disease = a wrap={false} unit; section title inside the first */}
            {(() => {
              const active = DISEASE_FIELDS.filter(d => record[d] && hasVal(record[d]));
              if (active.length === 0) return null;
              return (
                <View style={styles.section}>
                  {active.map((d, di) => {
                    const entries = Object.entries(record[d]).filter(([, v]) => hasVal(v));
                    if (entries.length === 0) return null;
                    return (
                      <View key={d} wrap={entries.length + (di === 0 ? 2 : 1) > 8 ? true : false} style={{ marginBottom: 6 }}>
                        {di === 0 && <Text style={styles.sectionTitle}>Chronic Conditions</Text>}
                        <Text style={styles.fieldLabel}>{d.charAt(0).toUpperCase() + d.slice(1)}</Text>
                        {entries.map(([k, v]) => (
                          <View key={k} style={{ marginBottom: 2 }}>
                            <Text style={styles.subLabel}>{DISEASE_PROP_LABELS[k] || humanizeKey(k)}</Text>
                            {Array.isArray(v)
                              ? safeArr(v).map((it, ii) => <Text key={ii} style={styles.listItem}>{ii + 1}. {it}</Text>)
                              : <Text style={styles.listItem}>1. {fmtVal(v)}</Text>}
                          </View>
                        ))}
                      </View>
                    );
                  })}
                </View>
              );
            })()}

            {/* Heart Disease */}
            {record.heartDisease && hasVal(record.heartDisease) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Heart Disease</Text>
                {['condition', 'type', 'rhythm', 'strokeRisk', 'bleedingRisk'].map(k => hasVal(record.heartDisease[k]) ? (
                  <View key={k} style={{ marginBottom: 4 }}><Text style={styles.fieldLabel}>{humanizeKey(k)}</Text><Text style={styles.listItem}>1. {fmtVal(record.heartDisease[k])}</Text></View>
                ) : null)}
                {safeArr(record.heartDisease.medications).length > 0 && (
                  <View style={{ marginBottom: 4 }}><Text style={styles.fieldLabel}>Medications</Text>{safeArr(record.heartDisease.medications).map((m, mi) => <Text key={mi} style={styles.listItem}>{mi + 1}. {m}</Text>)}</View>
                )}
              </View>
            )}

            {/* Quality Metrics */}
            {record.qualityMetrics && hasVal(record.qualityMetrics) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Quality Metrics</Text>
                {Object.entries(record.qualityMetrics).filter(([, v]) => hasVal(v)).map(([k, v]) => (
                  <View key={k} style={{ marginBottom: 4 }}><Text style={styles.fieldLabel}>{humanizeKey(k)}</Text><Text style={styles.listItem}>1. {fmtVal(v)}</Text></View>
                ))}
              </View>
            )}

            {renderArraySection('Management Plans', record.managementPlans)}
            {renderArraySection('Recommendations', record.recommendations)}

            {/* Results — scalar or object tree */}
            {hasVal(record.results) && (() => {
              const v = record.results;
              if (isScalar(v)) return (<View style={styles.section} wrap={false}><Text style={styles.sectionTitle}>Results</Text><Text style={styles.listItem}>1. {fmtVal(v)}</Text></View>);
              const entries = Object.entries(v).filter(([, x]) => !isEmptyDeep(x));
              if (entries.length === 0) return null;
              return (<View style={styles.section} wrap={entries.length + 1 > 8 ? true : false}><Text style={styles.sectionTitle}>Results</Text>{entries.map(([k, x]) => (<View key={k} style={{ marginBottom: 3 }}><Text style={styles.subLabel}>{humanizeKey(k)}</Text>{Array.isArray(x) ? safeArr(x).map((it, ii) => <Text key={ii} style={styles.listItem}>{ii + 1}. {fmtVal(it)}</Text>) : <Text style={styles.listItem}>1. {fmtVal(x)}</Text>}</View>))}</View>);
            })()}

            {renderNarrative('Findings', record.findings)}
            {renderNarrative('Assessment', record.assessment)}
            {renderNarrative('Plan', record.plan)}
            {renderNarrative('Notes', record.notes)}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default ChronicDiseaseManagementDocumentPDFTemplate;
