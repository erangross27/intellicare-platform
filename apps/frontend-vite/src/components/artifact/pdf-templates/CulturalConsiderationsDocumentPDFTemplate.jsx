/**
 * CulturalConsiderationsDocumentPDFTemplate.jsx
 * Box-free line-based layout (ConsultationNotes donor) — LETTER — B&W.
 * react-pdf 4.5.1: wrap = BOOLEANS; recordContainer paddingBottom only + break={idx>0} (Rule #75);
 * sectionTitle rides INSIDE the section's wrap-gated View (anti-orphan).
 * 4-area mirror of the JSX/copy: canonical splitBySentence ([;.] + abbrev guard) + guarded splitByComma;
 * labeled sentence with >=3 comma parts → sub-label + numbered rows; arrays/date/enum numbered; single-name label hidden.
 * Collection: cultural_considerations
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#000000' },
  title: { fontSize: 26, fontFamily: 'Helvetica-Bold', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1, color: '#000000' },
  recordContainer: { paddingBottom: 8 },
  recordHeader: { marginBottom: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', textTransform: 'uppercase', letterSpacing: 0.5, borderBottomWidth: 1, borderBottomColor: '#000000', paddingBottom: 3, marginBottom: 8 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#000000', borderBottomWidth: 0.5, borderBottomColor: '#999999', paddingBottom: 3, marginTop: 6, marginBottom: 4 },
  subLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', borderBottomWidth: 0.5, borderBottomColor: '#999999', paddingBottom: 2, marginTop: 4, marginBottom: 3 },
  listItem: { fontSize: 14, color: '#000000', marginBottom: 3, paddingLeft: 8, lineHeight: 1.4 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#000000' },
});

const FIELD_LABELS = {
  date: 'Date', provider: 'Provider', facility: 'Facility', status: 'Status',
  dietaryPreferences: 'Dietary Preferences',
  familyDynamics: 'Family Dynamics', supportStrategies: 'Support Strategies',
  findings: 'Findings', assessment: 'Assessment', plan: 'Plan',
  results: 'Results', recommendations: 'Recommendations',
  culturalResources: 'Cultural Resources', notes: 'Notes',
};
const SECTION_TITLES = {
  provider: 'Provider Information', dietary: 'Dietary Preferences', family: 'Family & Support',
  clinical: 'Clinical Assessment', results: 'Results', resources: 'Resources & Notes',
};
const SECTION_FIELDS = {
  provider: ['date', 'provider', 'facility', 'status'],
  dietary: ['dietaryPreferences'],
  family: ['familyDynamics', 'supportStrategies'],
  clinical: ['findings', 'assessment', 'plan'],
  results: ['results'],
  resources: ['culturalResources', 'recommendations', 'notes'],
};
const SECTION_ORDER = ['provider', 'dietary', 'family', 'clinical', 'results', 'resources'];
const DATE_FIELDS = ['date'];
const ARRAY_FIELDS = ['dietaryPreferences', 'supportStrategies', 'culturalResources', 'recommendations'];
const OBJECT_FIELDS = ['results'];
const SENTENCE_FIELDS = ['familyDynamics', 'findings', 'assessment', 'plan', 'notes'];
const ENUM_FIELDS = { status: ['Active', 'Not Active'] };

const isEmptyDeep = (v) => {
  if (v === null || v === undefined) return true;
  if (typeof v === 'boolean') return false;
  if (typeof v === 'number') return !Number.isFinite(v);
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0;
  if (typeof v === 'object') return Object.values(v).every(isEmptyDeep);
  return false;
};
const hasVal = (v) => !isEmptyDeep(v);
const isScalar = (v) => v === null || typeof v !== 'object';
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
const fmtEnumVal = (f, v) => { const opts = ENUM_FIELDS[f]; if (opts) { const hit = opts.find(o => o.toLowerCase() === String(v ?? '').toLowerCase().trim()); if (hit) return hit; } return null; };
const humanizeKey = (key) => { if (key === null || key === undefined || key === '') return ''; const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2'); return s.charAt(0).toUpperCase() + s.slice(1); };
const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|approx|no|No|i\.e|e\.g))[;.](?:\s+)/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); };
const parseLabel = (text) => { if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' }; const m = text.match(/^([A-Za-z][A-Za-z0-9 /()&,'.-]{1,80}?):\s+(.+)$/); return m ? { isLabeled: true, label: m[1].trim(), value: m[2].trim() } : { isLabeled: false, label: '', value: text }; };
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
      const t = cur.trim(); if (t) parts.push(t); cur = '';
    } else cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts.filter(Boolean);
};

/* recursive object → flat "Key: value" / "Key" lines (mirror of the JSX objectToLines) */
const objectToLines = (value, indent) => {
  const lines = [];
  const pad = '  '.repeat(indent);
  if (isScalar(value)) { lines.push(`${pad}${fmtScalar(value)}`); return lines; }
  Object.entries(value).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => {
    if (isScalar(v)) lines.push(`${pad}${humanizeKey(k)}: ${fmtScalar(v)}`);
    else { lines.push(`${pad}${humanizeKey(k)}`); objectToLines(v, indent + 1).forEach(l => lines.push(l)); }
  });
  return lines;
};

/* Build {k:'label'|'sub'|'row', t} lines for one field — the exact mirror of buildFieldLines. */
const fieldLines = (record, f, sectionTitle) => {
  const label = FIELD_LABELS[f] || f;
  const val = record[f];
  const lines = [];
  const showLabel = label.toLowerCase() !== String(sectionTitle || '').toLowerCase();
  const head = showLabel ? [{ k: 'label', t: label }] : [];
  if (ARRAY_FIELDS.includes(f)) {
    const items = (Array.isArray(val) ? val : []).map(x => String(x ?? '').trim()).filter(Boolean);
    if (items.length === 0) return lines;
    lines.push(...head);
    items.forEach((item, i) => lines.push({ k: 'row', t: `${i + 1}. ${item}` }));
  } else if (OBJECT_FIELDS.includes(f)) {
    if (!hasVal(val)) return lines;
    lines.push(...head);
    objectToLines(val, 0).forEach(l => lines.push({ k: 'row', t: l }));
  } else if (DATE_FIELDS.includes(f)) {
    if (!hasVal(val)) return lines;
    lines.push(...head, { k: 'row', t: `1. ${formatDate(val)}` });
  } else if (SENTENCE_FIELDS.includes(f)) {
    const strVal = String(val ?? ''); if (!strVal.trim()) return lines;
    lines.push(...head);
    let n = 0;
    splitBySentence(strVal).forEach(s => {
      const p = parseLabel(s);
      if (p.isLabeled) { const ci = splitByComma(p.value); if (ci.length >= 3) { lines.push({ k: 'sub', t: p.label }); n = 0; ci.forEach(c => lines.push({ k: 'row', t: `${++n}. ${c}` })); } else lines.push({ k: 'row', t: `${++n}. ${s}` }); }
      else lines.push({ k: 'row', t: `${++n}. ${s}` });
    });
  } else {
    if (!hasVal(val)) return lines;
    const strVal = fmtEnumVal(f, val) ?? fmtVal(val);
    lines.push(...head, { k: 'row', t: `1. ${strVal}` });
  }
  return lines;
};

const CulturalConsiderationsDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.cultural_considerations) return Array.isArray(r.cultural_considerations) ? r.cultural_considerations : [r.cultural_considerations];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.cultural_considerations) return Array.isArray(dd.cultural_considerations) ? dd.cultural_considerations : [dd.cultural_considerations]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (<Document><Page size="LETTER" style={styles.page}><View style={styles.documentHeader}><Text style={styles.title}>Cultural Considerations</Text></View><Text style={styles.emptyState}>No records available</Text></Page></Document>);
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Cultural Considerations</Text></View>
        {records.map((record, idx) => (
          // Rule #75: every record after the first STARTS ON A NEW PAGE; never record 0.
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`Cultural Considerations ${idx + 1}`}</Text>
            </View>
            {SECTION_ORDER.map(sid => {
              const title = SECTION_TITLES[sid];
              const lines = (SECTION_FIELDS[sid] || []).flatMap(f => fieldLines(record, f, title));
              if (lines.length === 0) return null;
              return (
                <View key={sid} style={styles.section} wrap={lines.length > 18 ? true : false}>
                  <Text style={styles.sectionTitle}>{title}</Text>
                  {lines.map((ln, i) => ln.k === 'label'
                    ? <Text key={i} style={styles.fieldLabel}>{ln.t}</Text>
                    : ln.k === 'sub'
                      ? <Text key={i} style={styles.subLabel}>{ln.t}</Text>
                      : <Text key={i} style={styles.listItem}>{ln.t}</Text>)}
                </View>
              );
            })}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default CulturalConsiderationsDocumentPDFTemplate;
