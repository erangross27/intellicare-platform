/**
 * ConnectiveTissueDiseaseAssessmentDocumentPDFTemplate.jsx
 * Box-free line-based layout (ConsultationNotes donor) — LETTER size — B&W.
 * react-pdf 4.5.1 engine rules: wrap props are BOOLEANS (explicit undefined = unbreakable);
 * recordContainer paddingBottom only (marginBottom → empty page 1) + break={idx>0} (Rule #75, each
 * record starts a new page); sectionTitle rides INSIDE the first present field's View (anti-orphan, 6a2d6af6).
 * Mirrors the JSX + copy exactly (4-area mirror): guarded splitters, sentence/detail/manifestation lists split
 * at >=3 commas (sub-label only on a genuine split); classification/organInvolvement render the criterion/organ
 * as the group header + secondary attrs (Met/Severity); results object walks key→value.
 * Collection: connective_tissue_disease_assessment
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
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', textTransform: 'uppercase', letterSpacing: 0.5, borderBottomWidth: 1, borderBottomColor: '#000000', paddingBottom: 3, marginBottom: 8 },
  fieldUnit: { marginBottom: 6 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#000000', borderBottomWidth: 0.5, borderBottomColor: '#999999', paddingBottom: 3, marginBottom: 4 },
  subLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', borderBottomWidth: 0.5, borderBottomColor: '#999999', paddingBottom: 2, marginBottom: 3, marginTop: 4 },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 3, paddingLeft: 8 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#000000' },
});

const FIELD_LABELS = { provider: 'Provider', facility: 'Facility', diagnosis: 'Diagnosis', status: 'Status', findings: 'Findings', assessment: 'Assessment', plan: 'Plan', notes: 'Notes', severity: 'Severity', scale: 'Scale', score: 'Score' };
const humanizeKey = (key) => { if (key === null || key === undefined || key === '') return ''; const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2'); return s.charAt(0).toUpperCase() + s.slice(1); };
const isScalar = (v) => v === null || typeof v !== 'object';
const isEmptyDeep = (v) => { if (v === null || v === undefined) return true; if (typeof v === 'boolean') return false; if (typeof v === 'number') return !Number.isFinite(v); if (typeof v === 'string') return v.trim() === ''; if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0; if (typeof v === 'object') return Object.values(v).every(isEmptyDeep); return false; };
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).filter(k => !k.startsWith('_')).length > 0; return true; };
const safeArr = (v) => Array.isArray(v) ? v.filter(Boolean) : [];
// Abbreviation+decimal guard: never break on "Dr. Smith", "vs. standard", "3.5 mg".
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|approx|no|No|i\.e|e\.g))[;.](?:\s+)/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); };
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [];
  const parts = []; let cur = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      const rest = text.slice(i + 1);
      if (!/^\s/.test(rest)) { cur += ch; continue; }
      if (/^\s+(?:and|or)\b/i.test(rest)) { cur += ch; continue; }
      if (/\d\s*$/.test(cur) && /^\s*\d{4}\b/.test(rest)) { cur += ch; continue; }
      parts.push(cur.trim()); cur = '';
    } else cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
};
const parseLabel = (s) => { const m = s.replace(/[;.]+$/, '').trim().match(/^([A-Za-z][A-Za-z0-9 /()-]{1,40}):\s*(.+)$/s); return m ? { isLabeled: true, label: m[1].trim(), value: m[2].trim() } : { isLabeled: false, label: null, value: s }; };

// One wrap-gated glue View; sectionTitle rides inside the first present field's View. Lines: {k:'label'|'sub'|'row', t}.
const fieldView = (lines, title, isFirst, keyId) => (
  <View key={keyId} style={styles.fieldUnit} wrap={lines.length > 20 ? true : false}>
    {isFirst ? <Text style={styles.sectionTitle}>{title}</Text> : null}
    {lines.map((ln, i) => {
      if (ln.k === 'label') return <Text key={i} style={styles.fieldLabel}>{ln.t}</Text>;
      if (ln.k === 'sub') return <Text key={i} style={styles.subLabel}>{ln.t}</Text>;
      return <Text key={i} style={styles.listItem}>{ln.t}</Text>;
    })}
  </View>
);
const section = (title, units) => units.length === 0 ? null : <View key={title} style={styles.section}>{units.map((lines, i) => fieldView(lines, title, i === 0, `${title}-${i}`))}</View>;

// Sentence field → lines with sub-labels on genuine >=3 comma splits (mirrors JSX/copy).
const sentenceLines = (label, val) => {
  const lines = [{ k: 'label', t: label }];
  let n = 0;
  splitBySentence(String(val)).forEach(s => {
    const p = parseLabel(s);
    const content = p.isLabeled ? p.value : s.replace(/[;.]+$/, '').trim();
    const c = splitByComma(content);
    if (c.length >= 3) { if (p.isLabeled) { lines.push({ k: 'sub', t: p.label }); n = 0; } c.forEach(part => lines.push({ k: 'row', t: `${++n}. ${part.replace(/[;.]+$/, '').trim()}` })); }
    else lines.push({ k: 'row', t: `${++n}. ${s.replace(/[;.]+$/, '').trim()}` });
  });
  return lines;
};
const commaValueLines = (val) => { const c = splitByComma(String(val)); return c.length >= 3 ? c.map((part, i) => ({ k: 'row', t: `${i + 1}. ${part}` })) : [{ k: 'row', t: `1. ${val}` }]; };

const ConnectiveTissueDiseaseAssessmentDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.connective_tissue_disease_assessment) return Array.isArray(r.connective_tissue_disease_assessment) ? r.connective_tissue_disease_assessment : [r.connective_tissue_disease_assessment];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.connective_tissue_disease_assessment) return Array.isArray(dd.connective_tissue_disease_assessment) ? dd.connective_tissue_disease_assessment : [dd.connective_tissue_disease_assessment]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (<Document><Page size="LETTER" style={styles.page}><View style={styles.documentHeader}><Text style={styles.title}>Connective Tissue Disease Assessment</Text></View><Text style={styles.emptyState}>No records available</Text></Page></Document>);
  }

  const renderRecord = (record) => {
    const out = [];
    // Provider Information (one glue unit)
    const pi = [];
    if (hasVal(record.date)) { pi.push({ k: 'label', t: 'Date' }, { k: 'row', t: `1. ${formatDate(record.date)}` }); }
    ['provider', 'facility', 'diagnosis', 'status'].forEach(f => { if (hasVal(record[f])) pi.push({ k: 'label', t: FIELD_LABELS[f] }, { k: 'row', t: `1. ${fmtScalar(record[f])}` }); });
    out.push(section('Provider Information', pi.length ? [pi] : []));
    // Clinical Narrative (one unit per field)
    const cn = ['findings', 'assessment', 'plan', 'notes'].filter(f => hasVal(record[f])).map(f => sentenceLines(FIELD_LABELS[f], record[f]));
    out.push(section('Clinical Narrative', cn));
    // Classification Criteria (one unit per criterion)
    const crit = safeArr(record.classificationCriteria).map(c => {
      const lines = [{ k: 'sub', t: c.criterion || 'Criterion' }];
      if (hasVal(c.details)) commaValueLines(c.details).forEach(l => lines.push(l));
      if (c.met !== undefined) lines.push({ k: 'sub', t: 'Met' }, { k: 'row', t: `1. ${c.met ? 'Yes' : 'No'}` });
      return lines;
    });
    out.push(section('Classification Criteria', crit));
    // Disease Activity (one glue unit)
    const da = record.diseaseActivity || {};
    const daL = [];
    ['severity', 'scale', 'score'].forEach(k => { if (hasVal(da[k])) daL.push({ k: 'label', t: FIELD_LABELS[k] }, { k: 'row', t: `1. ${fmtScalar(da[k])}` }); });
    out.push(section('Disease Activity', daL.length ? [daL] : []));
    // Organ Involvement (one unit per organ)
    const org = safeArr(record.organInvolvement).map(o => {
      const lines = [{ k: 'sub', t: o.organ || 'Organ' }];
      if (hasVal(o.manifestation)) commaValueLines(o.manifestation).forEach(l => lines.push(l));
      if (hasVal(o.severity)) lines.push({ k: 'sub', t: 'Severity' }, { k: 'row', t: `1. ${o.severity}` });
      return lines;
    });
    out.push(section('Organ Involvement', org));
    // Results (recursive object → one glue unit)
    const resL = [];
    const walk = (obj) => Object.entries(obj).filter(([k, v]) => !k.startsWith('_') && !isEmptyDeep(v)).forEach(([k, v]) => {
      if (v !== null && typeof v === 'object' && !Array.isArray(v)) { resL.push({ k: 'sub', t: humanizeKey(k) }); walk(v); }
      else resL.push({ k: 'sub', t: humanizeKey(k) }, { k: 'row', t: `1. ${fmtScalar(v)}` });
    });
    if (record.results && typeof record.results === 'object' && hasVal(record.results)) walk(record.results);
    out.push(section('Results', resL.length ? [resL] : []));
    // Recommendations (date-grouped, one glue unit)
    const recL = [];
    let prevDate = null, rn = 0;
    safeArr(record.recommendations).forEach(rec => {
      const d = (rec?.date || '').trim();
      if (d && d !== prevDate) { recL.push({ k: 'sub', t: d }); prevDate = d; rn = 0; }
      recL.push({ k: 'row', t: `${++rn}. ${(rec?.recommendation || '').trim()}` });
    });
    if (recL.length) recL.unshift({ k: 'label', t: 'Recommendations' });
    out.push(section('Recommendations', recL.length ? [recL] : []));
    return out.filter(Boolean);
  };

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Connective Tissue Disease Assessment</Text></View>
        {records.map((record, idx) => (
          // Rule #75: every record after the first STARTS ON A NEW PAGE; never on record 0.
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`Connective Tissue Disease Assessment ${idx + 1}`}</Text>
            </View>
            {renderRecord(record)}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default ConnectiveTissueDiseaseAssessmentDocumentPDFTemplate;
