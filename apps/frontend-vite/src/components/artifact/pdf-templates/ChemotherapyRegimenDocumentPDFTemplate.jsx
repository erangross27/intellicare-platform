/**
 * ChemotherapyRegimenDocumentPDFTemplate.jsx
 * Box-free line-based layout (ConsultationNotes donor) — LETTER size — B&W.
 * react-pdf 4.5.1 engine rules: wrap props are BOOLEANS (explicit undefined = unbreakable);
 * recordContainer uses paddingBottom only (marginBottom shoves the whole record → empty page 1);
 * per-FIELD gates with the section title inside the first field's unit + leaf glue (anti-orphan, 6a2d6af6).
 * Collection: chemotherapy_regimen
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 24, borderBottomWidth: 2, borderBottomColor: '#000000', paddingBottom: 12 },
  title: { fontSize: 26, fontFamily: 'Helvetica-Bold', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1 },
  recordContainer: { paddingBottom: 8 },
  recordHeader: { marginBottom: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', textTransform: 'uppercase', letterSpacing: 0.5, borderBottomWidth: 1, borderBottomColor: '#000000', paddingBottom: 3, marginBottom: 8 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#000000', borderBottomWidth: 0.5, borderBottomColor: '#999999', paddingBottom: 3, marginBottom: 4 },
  subLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 3, marginBottom: 2 },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 3, paddingLeft: 8 },
  nested: { marginLeft: 12 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#666666' },
});

const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
const isEmptyDeep = (v) => { if (v === null || v === undefined) return true; if (typeof v === 'boolean') return false; if (typeof v === 'number') return !Number.isFinite(v); if (typeof v === 'string') return v.trim() === ''; if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0; if (typeof v === 'object') return Object.values(v).every(isEmptyDeep); return false; };
const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return !isEmptyDeep(v); return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
const isScalar = (v) => v === null || typeof v !== 'object';
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
const safeArr = (v) => Array.isArray(v) ? v.filter(Boolean) : [];
// Split on sentence end, but NOT after an abbreviation ("vs.", "Dr.", etc.) or a decimal ("3.5").
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|approx|no|No|i\.e|e\.g))[;.](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); };

const KEY_OVERRIDES = { ef: 'EF', lvef: 'LVEF', bsa: 'BSA', auc: 'AUC', bun: 'BUN', wbc: 'WBC', anc: 'ANC', hgb: 'HGB', plt: 'PLT', gfr: 'GFR', ecog: 'ECOG' };
const humanizeKey = (key) => { if (key === null || key === undefined || key === '') return ''; if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key]; const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2'); return s.charAt(0).toUpperCase() + s.slice(1); };
const countRows = (val) => { if (isEmptyDeep(val)) return 0; if (isScalar(val)) return 2; if (Array.isArray(val)) { let n = 0; val.filter(x => !isEmptyDeep(x)).forEach(it => { n += isScalar(it) ? 1 : 1 + countRows(it); }); return n; } let n = 0; Object.values(val).forEach(sub => { if (!isEmptyDeep(sub)) n += isScalar(sub) ? 2 : 1 + countRows(sub); }); return n; };

const FL = { regimenName: 'Regimen Name', intent: 'Intent', cycleLength: 'Cycle Length', totalCycles: 'Total Cycles', growthFactorSupport: 'Growth Factor Support', status: 'Status', provider: 'Provider', facility: 'Facility', findings: 'Findings', assessment: 'Assessment', plan: 'Plan', notes: 'Notes' };
const SENTENCE_SPLIT_FIELDS = new Set(['findings', 'assessment', 'plan']);
const LABEL_SENTENCE_FIELDS = new Set(['notes']);

const showLbl = (f, sTitle) => (FL[f] || f).toLowerCase() !== String(sTitle).toLowerCase();

/* recursive object node — scalar leaf = own glue unit (sub-label + "1. value") */
const renderObjectNode = (label, value, keyPath, depth) => {
  if (isEmptyDeep(value)) return null;
  if (isScalar(value)) {
    return (
      <View key={keyPath} style={{ marginBottom: 6 }} wrap={false}>
        {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
        <Text style={styles.listItem}>1. {fmtScalar(value)}</Text>
      </View>
    );
  }
  const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
  if (entries.length === 0) return null;
  return (
    <View key={keyPath} wrap={countRows(value) > 8 ? true : false}>
      {label ? <Text style={styles.subLabel}>{label}</Text> : null}
      <View style={label ? styles.nested : undefined}>{entries.map(([k, v]) => renderObjectNode(humanizeKey(k), v, `${keyPath}-${k}`, depth + 1))}</View>
    </View>
  );
};

const fieldRowsOf = (record, f) => {
  const v = record[f];
  if (LABEL_SENTENCE_FIELDS.has(f) || SENTENCE_SPLIT_FIELDS.has(f)) return splitBySentence(String(v)).length + 1;
  return 2;
};

/* per-FIELD boolean gates; the section title rides inside the FIRST field's View (anti-orphan) */
const renderFieldSection = (sTitle, fields, record) => {
  const visible = fields.filter(f => hasVal(record[f]));
  if (visible.length === 0) return null;
  return (
    <View style={styles.section}>
      {visible.map((f, i) => {
        const rows = fieldRowsOf(record, f) + (i === 0 ? 1 : 0);
        return (
          <View key={f} wrap={rows > 8 ? true : false}>
            {i === 0 && <Text style={styles.sectionTitle}>{sTitle}</Text>}
            {LABEL_SENTENCE_FIELDS.has(f) ? (
              (() => { const sentences = splitBySentence(String(record[f])); return sentences.map((s, si) => { const ci = s.indexOf(':'); const lbl = ci > 0 && ci < 40 ? s.substring(0, ci).trim() : (showLbl(f, sTitle) ? FL[f] : null); const cnt = ci > 0 && ci < 40 ? s.substring(ci + 1).trim() : s; return (<View key={si} style={{ marginBottom: 6 }}>{lbl && <Text style={styles.fieldLabel}>{lbl}</Text>}<Text style={styles.listItem}>{si + 1}. {cnt.replace(/[.;]+$/, '').trim()}</Text></View>); }); })()
            ) : SENTENCE_SPLIT_FIELDS.has(f) ? (
              <View style={{ marginBottom: 6 }}>{showLbl(f, sTitle) && <Text style={styles.fieldLabel}>{FL[f] || f}</Text>}{splitBySentence(String(record[f])).map((s, si) => <Text key={si} style={styles.listItem}>{si + 1}. {s.replace(/[.;]+$/, '').trim()}</Text>)}</View>
            ) : (
              <View style={{ marginBottom: 6 }}>{showLbl(f, sTitle) && <Text style={styles.fieldLabel}>{FL[f] || f}</Text>}<Text style={styles.listItem}>1. {fmtVal(record[f])}</Text></View>
            )}
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

/* object section: each top-level entry its own gated View, title inside the first */
const renderObjectSection = (sTitle, value) => {
  if (!hasVal(value) || isScalar(value)) return null;
  const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
  if (entries.length === 0) return null;
  return (
    <View style={styles.section}>
      {entries.map(([k, v], i) => (
        <View key={k} wrap={countRows(v) > 8 ? true : false}>
          {i === 0 && <Text style={styles.sectionTitle}>{sTitle}</Text>}
          {renderObjectNode(humanizeKey(k), v, `results-${k}`, 1)}
        </View>
      ))}
    </View>
  );
};

/* drugs: name = sub-label, detail row beneath — each drug its own glue unit, title in first */
const renderDrugsSection = (drugs) => {
  const arr = safeArr(drugs);
  if (arr.length === 0) return null;
  return (
    <View style={styles.section}>
      {arr.map((d, i) => (
        <View key={i} wrap={false}>
          {i === 0 && <Text style={styles.sectionTitle}>Drugs</Text>}
          <View style={{ marginBottom: 6 }}>
            <Text style={styles.fieldLabel}>{d.name || `Drug ${i + 1}`}</Text>
            <Text style={styles.listItem}>1. {[d.dose, d.route, d.schedule].filter(Boolean).join(' — ')}</Text>
          </View>
        </View>
      ))}
    </View>
  );
};

const ChemotherapyRegimenDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.chemotherapy_regimen) return Array.isArray(r.chemotherapy_regimen) ? r.chemotherapy_regimen : [r.chemotherapy_regimen];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.chemotherapy_regimen) return Array.isArray(dd.chemotherapy_regimen) ? dd.chemotherapy_regimen : [dd.chemotherapy_regimen]; return [dd]; }
      return r;
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (<Document><Page size="LETTER" style={styles.page}><View style={styles.documentHeader}><Text style={styles.title}>Chemotherapy Regimen</Text></View><Text style={styles.emptyState}>No records available</Text></Page></Document>);
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Chemotherapy Regimen</Text></View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`Chemotherapy Regimen ${idx + 1}`}</Text>
            </View>
            {hasVal(record.date) && renderFieldSection('Date', ['date'], { date: formatDate(record.date) })}
            {renderFieldSection('Regimen Details', ['regimenName', 'intent', 'cycleLength', 'totalCycles', 'growthFactorSupport', 'status'], record)}
            {renderFieldSection('Provider Information', ['provider', 'facility'], record)}
            {renderDrugsSection(record.drugs)}
            {renderArraySection('Premedications', record.premedications)}
            {renderObjectSection('Results', record.results)}
            {renderFieldSection('Findings', ['findings'], record)}
            {renderFieldSection('Assessment', ['assessment'], record)}
            {renderFieldSection('Plan', ['plan'], record)}
            {renderFieldSection('Notes', ['notes'], record)}
            {renderArraySection('Recommendations', record.recommendations)}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default ChemotherapyRegimenDocumentPDFTemplate;
