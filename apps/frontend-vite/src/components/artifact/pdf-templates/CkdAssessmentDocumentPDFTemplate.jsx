/**
 * CkdAssessmentDocumentPDFTemplate.jsx
 * Box-free line-based layout (ConsultationNotes donor) — LETTER size — B&W.
 * react-pdf 4.5.1 engine rules: wrap props are BOOLEANS (explicit undefined = unbreakable);
 * recordContainer paddingBottom only (marginBottom → empty page 1) + break={idx>0} (Rule #75, each
 * record starts a new page); section title inside the first field's View (anti-orphan, 6a2d6af6).
 * Narrative fields sentence-split (guarded); every value numbered ("1." even for singles).
 * Collection: ckd_assessment
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
  subLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 2 },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 3, paddingLeft: 8 },
  nested: { marginLeft: 10, paddingLeft: 8, marginTop: 2 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#000000' },
});

const KEY_OVERRIDES = { ckd: 'CKD', egfr: 'eGFR', bun: 'BUN', gfr: 'GFR', mdrd: 'MDRD' };
const humanizeKey = (key) => { if (key === null || key === undefined || key === '') return ''; if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key]; const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2'); return s.charAt(0).toUpperCase() + s.slice(1); };
const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
const isEmptyDeep = (v) => { if (v === null || v === undefined) return true; if (typeof v === 'boolean') return false; if (typeof v === 'number') return !Number.isFinite(v); if (typeof v === 'string') return v.trim() === ''; if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0; if (typeof v === 'object') return Object.values(v).every(isEmptyDeep); return false; };
const hasVal = (v) => !isEmptyDeep(v);
const isScalar = (v) => v === null || typeof v !== 'object';
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
const safeArr = (v) => Array.isArray(v) ? v.filter(Boolean) : [];
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|approx|no|No|i\.e|e\.g))[;.](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); };

// one scalar field → label + "1. value" (numbered even for singles)
const numberedField = (label, value) => {
  if (!hasVal(value)) return null;
  return (<View style={{ marginBottom: 4 }}><Text style={styles.fieldLabel}>{label}</Text><Text style={styles.listItem}>1. {fmtVal(value)}</Text></View>);
};

/* recursive object node → sub-label + numbered leaf */
const renderObjectNode = (label, value, keyPath, depth) => {
  if (isEmptyDeep(value)) return null;
  const LabelTag = depth > 0 ? styles.subLabel : styles.fieldLabel;
  if (isScalar(value)) {
    return (<View key={keyPath}>{label ? <Text style={LabelTag}>{label}</Text> : null}<Text style={styles.listItem}>1. {fmtScalar(value)}</Text></View>);
  }
  const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
  if (entries.length === 0) return null;
  return (<View key={keyPath}>{label ? <Text style={LabelTag}>{label}</Text> : null}<View style={label ? styles.nested : undefined}>{entries.map(([k, v]) => renderObjectNode(humanizeKey(k), v, `${keyPath}-${k}`, depth + 1))}</View></View>);
};

const countRows = (val) => {
  if (isEmptyDeep(val)) return 0;
  if (isScalar(val)) return 1;
  if (Array.isArray(val)) { let n = 0; val.filter(x => !isEmptyDeep(x)).forEach(it => { n += isScalar(it) ? 1 : 1 + countRows(it); }); return n; }
  let n = 0; Object.values(val).forEach(sub => { if (!isEmptyDeep(sub)) n += isScalar(sub) ? 2 : 1 + countRows(sub); }); return n;
};

/* OBJECT field — each top-level key its own wrap-gated View (Rule #74), sectionTitle inside first */
const renderObjectSection = (val, sectionTitle) => {
  if (!hasVal(val) || isScalar(val)) return null;
  const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
  if (entries.length === 0) return null;
  return (
    <View style={styles.section}>
      {entries.map(([k, v], i) => (
        <View key={k} wrap={countRows(v) > 8 ? true : false} style={{ marginBottom: 4 }}>
          {i === 0 ? <Text style={styles.sectionTitle}>{sectionTitle}</Text> : null}
          {renderObjectNode(humanizeKey(k), v, `${sectionTitle}-${k}`, 1)}
        </View>
      ))}
    </View>
  );
};

/* narrative field section — sentence-split, numbered; title inside the single glue unit */
const renderNarrativeSection = (sTitle, value) => {
  if (!hasVal(value)) return null;
  const rows = splitBySentence(String(value));
  const body = rows.length ? rows.map((s, i) => <Text key={i} style={styles.listItem}>{i + 1}. {s}</Text>) : <Text style={styles.listItem}>1. {fmtVal(value)}</Text>;
  return (<View style={styles.section} wrap={(rows.length || 1) + 1 > 22 ? true : false}><Text style={styles.sectionTitle}>{sTitle}</Text>{body}</View>);
};

const CkdAssessmentDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.ckd_assessment) return Array.isArray(r.ckd_assessment) ? r.ckd_assessment : [r.ckd_assessment];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.ckd_assessment) return Array.isArray(dd.ckd_assessment) ? dd.ckd_assessment : [dd.ckd_assessment]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (<Document><Page size="LETTER" style={styles.page}><View style={styles.documentHeader}><Text style={styles.title}>CKD Assessment</Text></View><Text style={styles.emptyState}>No records available</Text></Page></Document>);
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>CKD Assessment</Text></View>
        {records.map((record, idx) => (
          // Rule #75: every record after the first STARTS ON A NEW PAGE; never on record 0.
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`CKD Assessment ${idx + 1}`}</Text>
              {record.date && <Text style={styles.recordMeta}>{formatDate(record.date)}</Text>}
            </View>

            {/* CKD Stage & Labs */}
            {(hasVal(record.stage) || hasVal(record.egfr) || hasVal(record.creatinine) || hasVal(record.bun) || hasVal(record.bunCreatinineRatio)) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>CKD Stage & Labs</Text>
                {numberedField('CKD Stage', record.stage)}
                {numberedField('eGFR', record.egfr)}
                {numberedField('Creatinine', record.creatinine)}
                {numberedField('BUN', record.bun)}
                {numberedField('BUN/Creatinine Ratio', record.bunCreatinineRatio)}
              </View>
            )}

            {/* eGFR Trend */}
            {safeArr(record.egfrTrend).length > 0 && (
              <View style={styles.section} wrap={safeArr(record.egfrTrend).length + 1 > 8 ? true : false}>
                <Text style={styles.sectionTitle}>eGFR Trend</Text>
                {record.egfrTrend.map((t, i) => <Text key={i} style={styles.listItem}>{i + 1}. {t.date || ''}: {t.value || ''}</Text>)}
              </View>
            )}

            {/* Creatinine Trend */}
            {safeArr(record.creatinineTrend).length > 0 && (
              <View style={styles.section} wrap={safeArr(record.creatinineTrend).length + 1 > 8 ? true : false}>
                <Text style={styles.sectionTitle}>Creatinine Trend</Text>
                {record.creatinineTrend.map((t, i) => <Text key={i} style={styles.listItem}>{i + 1}. {t.date || ''}: {t.value || ''}</Text>)}
              </View>
            )}

            {/* Progression */}
            {(hasVal(record.progressionRate) || hasVal(record.etiology)) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Progression</Text>
                {numberedField('Progression Rate', record.progressionRate)}
                {numberedField('Etiology', record.etiology)}
              </View>
            )}

            {/* Risk Factors (single-name → no field label) */}
            {safeArr(record.progressionRiskFactors).length > 0 && (
              <View style={styles.section} wrap={safeArr(record.progressionRiskFactors).length + 1 > 8 ? true : false}>
                <Text style={styles.sectionTitle}>Risk Factors</Text>
                {record.progressionRiskFactors.map((item, i) => <Text key={i} style={styles.listItem}>{i + 1}. {item}</Text>)}
              </View>
            )}

            {/* Chronicity */}
            {renderObjectSection(record.chronicity, 'Chronicity')}

            {/* Findings */}
            {renderNarrativeSection('Findings', record.findings)}

            {/* Clinical Assessment */}
            {renderNarrativeSection('Clinical Assessment', record.assessment)}

            {/* Plan */}
            {renderNarrativeSection('Plan', record.plan)}

            {/* Results */}
            {renderObjectSection(record.results, 'Results')}

            {/* Recommendations */}
            {safeArr(record.recommendations).filter(r => r?.recommendation).length > 0 && (
              <View style={styles.section}>
                {(() => {
                  const rs = record.recommendations.filter(r => r?.recommendation);
                  const gs = [];
                  rs.forEach(r => { const d = r.date ? String(r.date) : ''; const last = gs[gs.length - 1]; if (last && last.k === d) last.items.push(r.recommendation); else gs.push({ k: d, date: r.date || null, items: [r.recommendation] }); });
                  let n = 0;
                  return gs.map((g, gi) => (
                    <View key={gi} wrap={g.items.length + (gi === 0 ? 2 : 1) > 8 ? true : false}>
                      {gi === 0 && <Text style={styles.sectionTitle}>Recommendations</Text>}
                      {g.date && <Text style={styles.subLabel}>{formatDate(g.date)}</Text>}
                      {(() => { if (g.date) n = 0; return g.items.map(it => <Text key={n} style={styles.listItem}>{++n}. {it}</Text>); })()}
                    </View>
                  ));
                })()}
              </View>
            )}

            {/* Provider Information */}
            {(hasVal(record.provider) || hasVal(record.facility) || hasVal(record.status)) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Provider Information</Text>
                {numberedField('Provider', record.provider)}
                {numberedField('Facility', record.facility)}
                {numberedField('Status', record.status)}
              </View>
            )}

            {/* Notes */}
            {renderNarrativeSection('Notes', record.notes)}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default CkdAssessmentDocumentPDFTemplate;
