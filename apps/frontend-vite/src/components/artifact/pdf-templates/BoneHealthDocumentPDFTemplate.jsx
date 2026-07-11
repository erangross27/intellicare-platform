/**
 * BoneHealthDocumentPDFTemplate.jsx
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
  nestedLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 1, paddingLeft: 4 },
  nestedGroup: { marginLeft: 10, paddingLeft: 8, borderLeftWidth: 1, borderLeftColor: '#000000', marginTop: 2 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#666666' },
});

const KEY_OVERRIDES = { tScore: 'T-Score', zScore: 'Z-Score', bmd: 'BMD', dexa: 'DEXA', frax: 'FRAX', id: 'ID' };
const humanizeKey = (key) => { if (key === null || key === undefined || key === '') return ''; if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key]; const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2'); return s.charAt(0).toUpperCase() + s.slice(1); };

const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
const isEmptyDeep = (v) => { if (v === null || v === undefined) return true; if (typeof v === 'boolean') return false; if (typeof v === 'number') return !Number.isFinite(v); if (typeof v === 'string') return v.trim() === ''; if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0; if (typeof v === 'object') return Object.values(v).every(isEmptyDeep); return false; };
const hasVal = (v) => !isEmptyDeep(v);
const isScalar = (v) => v === null || typeof v !== 'object';
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
const splitBySentence = (text) => { if (!text) return []; return text.split(/\.\s+/).map(s => s.trim()).filter(s => s.length > 0 && s.replace(/[.!?;,]+/g, '').trim().length > 0); };

/* label:value parsing for clinical fields (findings/assessment) — identical logic to the JSX template
   so the PDF mirrors the on-screen nested-subtitle mini-cards (never side-by-side Label: value). */
const ABBR_RE = /^(?:Mr|Mrs|Ms|Dr|Prof|Rev|Sr|Jr|St|Gen|Col|Sgt|Lt|Capt|vs|etc)$/i;
const parseLabel = (s) => {
  const str = String(s ?? ''); const m = str.match(/^([^:]{1,80}):(\s+)(\S[\s\S]*)$/);
  if (!m) return { isLabeled: false, label: '', value: str, prefix: '' };
  return { isLabeled: true, label: m[1].trim(), value: m[3], prefix: m[1] + ':' + m[2] };
};
const tokenizeClauses = (text) => {
  const s = String(text ?? ''); const tokens = []; let depth = 0, start = 0, i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === '(' || c === '[') { depth++; i++; continue; }
    if (c === ')' || c === ']') { depth = Math.max(0, depth - 1); i++; continue; }
    if (depth === 0 && c === '.') { const m = s.slice(i).match(/^\.\s+/); if (m) { const wm = s.slice(0, i).match(/([A-Za-z]+)$/); if (!(wm && ABBR_RE.test(wm[1]))) { tokens.push({ raw: s.slice(start, i), sep: m[0] }); start = i + m[0].length; i = start; continue; } } }
    if (depth === 0 && c === ',') { const m = s.slice(i).match(/^,\s*/); const before = s[i - 1] || ''; const rest = s.slice(i + m[0].length); const after = rest[0] || ''; const betweenDigits = /\d/.test(before) && /\d/.test(after); const beforeYear = /^\d{4}\b/.test(rest); const beforeAndOr = /^(?:and|or)\b/i.test(rest); if (!betweenDigits && !beforeYear && !beforeAndOr) { tokens.push({ raw: s.slice(start, i), sep: m[0] }); start = i + m[0].length; i = start; continue; } }
    i++;
  }
  tokens.push({ raw: s.slice(start), sep: '' });
  return tokens;
};
const parseClinicalItems = (text) => {
  const toks = tokenizeClauses(text); const items = [];
  toks.forEach(tok => { const p = parseLabel(tok.raw); if (p.isLabeled || items.length === 0) { items.push({ ...p, raw: tok.raw, sep: tok.sep }); } else { const prev = items[items.length - 1]; prev.raw = prev.raw + prev.sep + tok.raw; prev.sep = tok.sep; prev.value = prev.raw.slice(prev.prefix.length); } });
  return items;
};
/* Clinical field block for the PDF: field label (subSectionTitle) then, per label:value item,
   the item label (nestedLabel) above its value line. Plain narrative → single value line. */
const renderClinicalField = (f, value) => {
  const items = parseClinicalItems(value);
  const label = humanizeKey(f);
  if (!items.some(it => it.isLabeled)) return (<View key={f}><Text style={styles.subSectionTitle}>{label}</Text><Text style={styles.listItem}>{String(value)}</Text></View>);
  return (<View key={f}><Text style={styles.subSectionTitle}>{label}</Text>{items.map((it, k) => (<View key={k}>{it.isLabeled && <Text style={styles.nestedLabel}>{it.label}</Text>}<Text style={styles.listItem}>{it.value}</Text></View>))}</View>);
};

/* count rows for the wrap heuristic (Rule #74) */
const countRows = (val) => {
  if (isEmptyDeep(val)) return 0;
  if (isScalar(val)) return 1;
  if (Array.isArray(val)) { let n = 0; val.filter(x => !isEmptyDeep(x)).forEach(it => { n += isScalar(it) ? 1 : 1 + countRows(it); }); return n; }
  let n = 0; Object.values(val).forEach(sub => { if (!isEmptyDeep(sub)) n += isScalar(sub) ? 2 : 1 + countRows(sub); }); return n;
};

/* recursive object node: label = bold heading; value = plain line below */
const renderObjectNode = (label, value, keyPath, depth) => {
  if (isEmptyDeep(value)) return null;
  const LabelTag = depth > 0 ? styles.nestedLabel : styles.subSectionTitle;
  if (isScalar(value)) {
    return (<View key={keyPath}>{label ? <Text style={LabelTag}>{label}</Text> : null}<Text style={styles.listItem}>{fmtScalar(value)}</Text></View>);
  }
  const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
  if (entries.length === 0) return null;
  return (<View key={keyPath}>{label ? <Text style={LabelTag}>{label}</Text> : null}<View style={label ? styles.nestedGroup : undefined}>{entries.map(([k, v]) => renderObjectNode(humanizeKey(k), v, `${keyPath}-${k}`, depth + 1))}</View></View>);
};

const BoneHealthDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => { if (r?.bone_health) return Array.isArray(r.bone_health) ? r.bone_health : [r.bone_health]; if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.bone_health) return Array.isArray(dd.bone_health) ? dd.bone_health : [dd.bone_health]; return [dd]; } return r; });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) return <Document><Page size="A4" style={styles.page}><Text style={styles.documentTitle}>Bone Health</Text><Text style={styles.emptyState}>No records available</Text></Page></Document>;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.documentTitle}>Bone Health</Text>
        {records.map((record, idx) => {
          const dexa = record.dexaScan;
          const riskFactors = Array.isArray(record.riskFactors) ? record.riskFactors.filter(Boolean) : [];
          const fractures = Array.isArray(record.fractures) ? record.fractures.filter(Boolean) : [];
          const recs = Array.isArray(record.recommendations) ? record.recommendations.filter(Boolean) : [];
          const therapyItems = hasVal(record.boneProtectionTherapy) ? record.boneProtectionTherapy.split(/,\s*/).filter(s => s.trim()) : [];
          return (
            <View key={idx} style={styles.recordSection}>
              <View wrap={false}><Text style={styles.recordTitle}>{`Bone Health ${idx + 1}`}</Text>{record.date && <Text style={styles.recordMeta}>{formatDate(record.date)}</Text>}</View>

              {dexa && (dexa.tScore || dexa.result || dexa.scheduledDate) && (<View style={styles.fieldContainer} wrap={false}><Text style={styles.sectionTitle}>DEXA Scan</Text>{dexa.tScore && <><Text style={styles.subSectionTitle}>T-Score</Text><Text style={styles.listItem}>{dexa.tScore}</Text></>}{dexa.result && <><Text style={styles.subSectionTitle}>Result</Text><Text style={styles.listItem}>{dexa.result}</Text></>}{dexa.scheduledDate && <><Text style={styles.subSectionTitle}>Scheduled Date</Text><Text style={styles.listItem}>{dexa.scheduledDate}</Text></>}</View>)}

              {therapyItems.length > 0 && (<View style={styles.fieldContainer} wrap={false}><Text style={styles.sectionTitle}>Bone Protection Therapy</Text>{therapyItems.map((item, i) => <Text key={i} style={styles.listItem}>{i + 1}. {item.trim()}</Text>)}</View>)}

              {riskFactors.length > 0 && (<View style={styles.fieldContainer} wrap={false}><Text style={styles.sectionTitle}>Risk Factors</Text>{riskFactors.map((item, i) => <Text key={i} style={styles.listItem}>{i + 1}. {item}</Text>)}</View>)}

              {fractures.length > 0 && (<View style={styles.fieldContainer} wrap={false}><Text style={styles.sectionTitle}>Fractures</Text>{fractures.map((item, i) => <Text key={i} style={styles.listItem}>{i + 1}. {item}</Text>)}</View>)}

              {(hasVal(record.findings) || hasVal(record.assessment)) && (() => { const cfields = ['findings', 'assessment'].filter(f => hasVal(record[f])); const clinicalRows = cfields.reduce((n, f) => { const its = parseClinicalItems(record[f]); return n + (its.some(it => it.isLabeled) ? 1 + its.length * 2 : 2); }, 0); return (<View style={styles.fieldContainer} wrap={clinicalRows > 8 ? undefined : false}><Text style={styles.sectionTitle}>Clinical Assessment</Text>{cfields.map(f => renderClinicalField(f, record[f]))}</View>); })()}

              {hasVal(record.plan) && (<View style={styles.fieldContainer} wrap={false}><Text style={styles.sectionTitle}>Plan</Text>{splitBySentence(record.plan).map((s, i) => <Text key={i} style={styles.listItem}>{i + 1}. {s.replace(/\.$/, '')}</Text>)}</View>)}

              {hasVal(record.results) && !isScalar(record.results) && (() => { const entries = Object.entries(record.results).filter(([, v]) => !isEmptyDeep(v)); if (entries.length === 0) return null; const rows = countRows(record.results); return (<View style={styles.fieldContainer} wrap={rows > 8 ? undefined : false}><Text style={styles.sectionTitle}>Results</Text>{entries.map(([k, v]) => renderObjectNode(humanizeKey(k), v, `results-${k}`, 1))}</View>); })()}

              {recs.length > 0 && (<View style={styles.fieldContainer} wrap={false}><Text style={styles.sectionTitle}>Recommendations</Text>{recs.map((item, i) => { const t = typeof item === 'object' ? (item.recommendation || '') : String(item); return <Text key={i} style={styles.listItem}>{i + 1}. {t}</Text>; })}</View>)}

              {(hasVal(record.provider) || hasVal(record.facility) || hasVal(record.status)) && (<View style={styles.fieldContainer} wrap={false}><Text style={styles.sectionTitle}>Provider Information</Text>{hasVal(record.provider) && <><Text style={styles.subSectionTitle}>Provider</Text><Text style={styles.listItem}>{record.provider}</Text></>}{hasVal(record.facility) && <><Text style={styles.subSectionTitle}>Facility</Text><Text style={styles.listItem}>{record.facility}</Text></>}{hasVal(record.status) && <><Text style={styles.subSectionTitle}>Status</Text><Text style={styles.listItem}>{record.status}</Text></>}</View>)}

              {hasVal(record.notes) && (<View style={styles.fieldContainer} wrap={false}><Text style={styles.sectionTitle}>Notes</Text><Text style={styles.listItem}>{record.notes}</Text></View>)}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default BoneHealthDocumentPDFTemplate;
