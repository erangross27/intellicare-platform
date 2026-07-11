/**
 * MyositisAssessmentDocumentPDFTemplate.jsx
 * June 2026 - Helvetica - A4 - BLACK & WHITE only (#000000 titles/borders/values, NO blue).
 * Collection: myositis_assessment.
 *
 * BOX-FREE canonical (mirrors HematologyAssessmentDocumentPDFTemplate): no card/box backgrounds or
 * borders - underline rules ONLY (documentTitle 2pt / recordTitle + sectionTitle 1pt / fieldLabel 0.5pt).
 * Config-driven from the JSX SECTION_ORDER / SECTION_TITLES / FIELD_LABELS / SECTION_FIELDS so the PDF
 * renders EVERY populated field the JSX renders (JSX/PDF field parity).
 *
 * Generic recursive renderer (memory: resolvePath + objectRows + fieldBody) handles the DEEP nesting:
 *   muscleWeakness { distribution, mrcScale{deltoid...}, functionalImpact }, muscleEnzymes, results ->
 *   objectRows (scalars inline "Key: value", nested objects under a subLabel). skinManifestations booleans
 *   -> Yes/No. myositisAntibodies (array of strings) -> numbered. recommendations [{recommendation,date}]
 *   -> date-grouped. Narratives -> sentenceRows ([.;] split, abbrev/single-initial guard, labeled -> subLabel).
 * Real record.date is rendered as the record date (NEVER createdAt/updatedAt).
 * Rule #74: each field is ONE wrap={false} atomic View with the sectionTitle riding INSIDE the first
 * present field's View (anti-orphan). safeString: \uXXXX escapes only (0 non-ASCII bytes). Static PHI footer.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, paddingBottom: 64, fontFamily: 'Helvetica', fontSize: 12, lineHeight: 1.5, backgroundColor: '#ffffff', color: '#000000' },
  documentTitle: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 16, paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 14, marginBottom: 10, paddingBottom: 5, borderBottomWidth: 1, borderBottomColor: '#000000' },
  section: { marginBottom: 12 },
  fieldGroup: { marginBottom: 8 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 8, marginBottom: 6, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000' },
  fieldLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  subLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 1 },
  value: { fontSize: 11, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  footer: { position: 'absolute', bottom: 24, left: 40, right: 40, fontSize: 9, color: '#666666', textAlign: 'center', borderTopWidth: 0.5, borderTopColor: '#cccccc', paddingTop: 6 },
  noData: { fontSize: 14, textAlign: 'center', marginTop: 40, color: '#666666' },
});

/* ======= CONFIG (mirrors the JSX) ======= */
const SECTION_ORDER = ['overview', 'muscle-assessment', 'skin-antibodies', 'findings-plan', 'results-section', 'recommendations-section'];
const SECTION_TITLES = {
  'overview': 'Overview',
  'muscle-assessment': 'Muscle Assessment',
  'skin-antibodies': 'Skin & Antibodies',
  'findings-plan': 'Findings & Plan',
  'results-section': 'Results',
  'recommendations-section': 'Recommendations',
};
const FIELD_LABELS = {
  date: 'Date', type: 'Type', provider: 'Provider', facility: 'Facility', status: 'Status',
  muscleWeakness: 'Muscle Weakness', muscleEnzymes: 'Muscle Enzymes', emgFindings: 'EMG Findings',
  muscleBiopsy: 'Muscle Biopsy', skinManifestations: 'Skin Manifestations', myositisAntibodies: 'Myositis Antibodies',
  findings: 'Findings', assessment: 'Assessment', plan: 'Plan', notes: 'Notes', results: 'Results', recommendations: 'Recommendations',
};
const SECTION_FIELDS = {
  'overview': ['date', 'type', 'provider', 'facility', 'status'],
  'muscle-assessment': ['muscleWeakness', 'muscleEnzymes', 'emgFindings', 'muscleBiopsy'],
  'skin-antibodies': ['skinManifestations', 'myositisAntibodies'],
  'findings-plan': ['findings', 'assessment', 'plan', 'notes'],
  'results-section': ['results'],
  'recommendations-section': ['recommendations'],
};
const DATE_FIELDS = ['date'];
const OBJECT_ARRAY_FIELDS = ['recommendations'];

const KEY_OVERRIDES = {
  ck: 'CK', CK: 'CK', ldh: 'LDH', ast: 'AST', alt: 'ALT', mrcScale: 'MRC Scale',
  antibodyPanel: 'Antibody Panel', mechanicsHands: "Mechanic's Hands",
};
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key];
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/* safeString: sanitize for react-pdf (Helvetica). ONLY \uXXXX escape sequences - NEVER paste a literal
   smart-quote / em-dash / BOM into this regex source (that causes "Unterminated regular expression"). */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  const str = typeof val === 'number' ? String(val) : typeof val === 'boolean' ? (val ? 'Yes' : 'No') : String(val);
  return str
    .replace(/[\u2018\u2019\u201B]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u00A0/g, ' ')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u2028\u2029\uFEFF]/g, '');
};

const resolvePath = (obj, path) => { if (!obj || !path) return undefined; return path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj); };
const formatDate = (d) => { if (!d) return ''; try { const dt = new Date(d.$date || d); if (isNaN(dt.getTime())) return String(d); return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
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

const CLAUSE_OPENER = /^(if|when|while|unless|although|though|because|since|after|before|once|given|whether|should|as|until|provided|assuming|in case)\b/i;
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m && !CLAUSE_OPENER.test(m[1].trim())) return { isLabeled: true, label: m[1].trim(), value: m[2].trim().replace(/^\d+\.\s+/, '') };
  return { isLabeled: false, label: '', value: text };
};
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|[A-Z]))[.;](?:\s+)/).map(s => s.trim().replace(/^\d+\.\s+/, '')).filter(s => s && !/^[;.,!?]+$/.test(s)); };
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0 && /\s/.test(text[i + 1] || '')) { const t = current.trim(); if (t) result.push(t); current = ''; }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

const strip = (s) => safeString(s).replace(/^\s*\d+\.\s+/, '').replace(/[;.]+$/, '').trim();

/* narrative -> rows: splitBySentence -> parseLabel -> splitByComma (labeled "Label: a, b" decomposes to
   a subLabel + comma-split numbered items; a plain sentence is one numbered value). */
const sentenceRows = (text) => {
  const rows = []; let n = 1;
  splitBySentence(text).forEach((sentence) => {
    const p = parseLabel(sentence);
    if (p.isLabeled) {
      const items = splitByComma(p.value);
      if (items.length >= 2) {
        rows.push({ type: 'sub', text: safeString(p.label) });
        items.forEach(it => { const ip = parseLabel(it); if (ip.isLabeled) { rows.push({ type: 'sub', text: safeString(ip.label) }); rows.push({ type: 'item', text: strip(ip.value), num: n++ }); } else rows.push({ type: 'item', text: strip(it), num: n++ }); });
      } else { rows.push({ type: 'sub', text: safeString(p.label) }); rows.push({ type: 'item', text: strip(p.value), num: n++ }); }
    } else { rows.push({ type: 'item', text: strip(sentence), num: n++ }); }
  });
  return rows;
};

/* Recursively flatten a nested object into box-free rows (scalars inline "Key: value"). */
const objectRows = (obj, kp) => {
  const out = [];
  Object.entries(obj).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v], i) => {
    const key = `${kp}.${k}.${i}`;
    if (isScalar(v)) {
      out.push(<Text key={key} style={styles.value}>{humanizeKey(k)}: {safeString(fmtScalar(v))}</Text>);
    } else if (Array.isArray(v)) {
      out.push(<Text key={key + 'h'} style={styles.subLabel}>{humanizeKey(k)}</Text>);
      v.filter(x => !isEmptyDeep(x)).forEach((it, j) => {
        if (isScalar(it)) out.push(<Text key={key + '-' + j} style={styles.value}>{j + 1}. {safeString(fmtScalar(it))}</Text>);
        else objectRows(it, key + '-' + j).forEach(r => out.push(r));
      });
    } else {
      out.push(<Text key={key + 'h'} style={styles.subLabel}>{humanizeKey(k)}</Text>);
      objectRows(v, key).forEach(r => out.push(r));
    }
  });
  return out;
};

/* Top-level value -> rows for one field. */
const fieldBody = (field, val) => {
  if (DATE_FIELDS.includes(field)) return [<Text key="d" style={styles.value}>{safeString(formatDate(val))}</Text>];
  if (OBJECT_ARRAY_FIELDS.includes(field)) {
    const recs = Array.isArray(val) ? val.filter(r => !isEmptyDeep(r)) : [];
    const groups = [];
    recs.forEach((r) => { const d = (r?.date || '').trim(); const last = groups[groups.length - 1]; if (last && last.date === d) last.items.push(r); else groups.push({ date: d, items: [r] }); });
    const out = [];
    groups.forEach((g, gi) => {
      if (g.date) out.push(<Text key={`g${gi}`} style={styles.subLabel}>{safeString(g.date)}</Text>);
      g.items.forEach((r, i) => out.push(<Text key={`g${gi}-${i}`} style={styles.value}>{i + 1}. {safeString((r?.recommendation || '').trim())}</Text>));
    });
    return out;
  }
  if (isScalar(val)) {
    if (typeof val === 'string') {
      const rows = sentenceRows(val);
      if (rows.length > 1) return rows.map((r, i) => r.type === 'sub'
        ? <Text key={i} style={styles.subLabel}>{r.text}</Text>
        : <Text key={i} style={styles.value}>{r.num}. {r.text}</Text>);
      return [<Text key="s" style={styles.value}>{safeString(val)}</Text>];
    }
    return [<Text key="n" style={styles.value}>{safeString(fmtScalar(val))}</Text>];
  }
  if (Array.isArray(val)) {
    const items = val.filter(x => !isEmptyDeep(x));
    if (items.every(isScalar)) return items.map((it, i) => <Text key={i} style={styles.value}>{i + 1}. {safeString(fmtScalar(it))}</Text>);
    const out = [];
    items.forEach((it, i) => { if (isScalar(it)) out.push(<Text key={'s' + i} style={styles.value}>{i + 1}. {safeString(fmtScalar(it))}</Text>); else objectRows(it, 'o' + i).forEach(r => out.push(r)); });
    return out;
  }
  return objectRows(val, 'obj');
};

/* Rule #74: each field is ONE wrap={false} atomic View; sectionTitle rides INSIDE the first field. */
const renderField = (record, field, sectionTitle, isFirst) => {
  const val = resolvePath(record, field);
  if (!hasVal(val)) return [];
  const label = FIELD_LABELS[field] || field;
  const showLabel = label.trim().toLowerCase() !== (sectionTitle || '').trim().toLowerCase();
  const titleNode = isFirst ? <Text style={styles.sectionTitle}>{safeString(sectionTitle)}</Text> : null;
  return [(
    <View key={field} style={styles.fieldGroup} wrap={false}>
      {titleNode}{showLabel && <Text style={styles.fieldLabel}>{safeString(label)}</Text>}
      {fieldBody(field, val)}
    </View>
  )];
};

const MyositisAssessmentDocumentPDFTemplate = ({ document: data }) => {
  let records = [];
  if (Array.isArray(data)) {
    if (data.length === 1 && data[0]?.myositis_assessment) records = Array.isArray(data[0].myositis_assessment) ? data[0].myositis_assessment : [data[0].myositis_assessment];
    else records = data;
  } else if (data?.myositis_assessment) records = Array.isArray(data.myositis_assessment) ? data.myositis_assessment : [data.myositis_assessment];
  else if (data?.documentData) { const dd = data.documentData; if (Array.isArray(dd)) records = dd; else if (dd?.myositis_assessment) records = Array.isArray(dd.myositis_assessment) ? dd.myositis_assessment : [dd.myositis_assessment]; else if (dd && typeof dd === 'object') records = [dd]; }
  else if (data && typeof data === 'object') records = [data];
  records = (records || []).filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (
      <Document><Page size="A4" style={styles.page}>
        <Text style={styles.documentTitle}>Myositis Assessment</Text>
        <Text style={styles.noData}>No myositis assessment records available.</Text>
      </Page></Document>
    );
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.documentTitle}>Myositis Assessment</Text>
        {records.map((record, rIdx) => (
          <View key={rIdx}>
            <Text style={styles.recordTitle} break={rIdx > 0}>{safeString(`Myositis Assessment ${String(record._recordNumber || rIdx + 1)}`)}</Text>
            {SECTION_ORDER.map((sid) => {
              const presentFields = (SECTION_FIELDS[sid] || []).filter(f => hasVal(resolvePath(record, f)));
              if (presentFields.length === 0) return null;
              const title = SECTION_TITLES[sid];
              return (
                <View key={sid} style={styles.section}>
                  {presentFields.flatMap((f, fi) => renderField(record, f, title, fi === 0))}
                </View>
              );
            })}
          </View>
        ))}
        <Text style={styles.footer} fixed>This document contains Protected Health Information (PHI). Handle in accordance with HIPAA.</Text>
      </Page>
    </Document>
  );
};

export default MyositisAssessmentDocumentPDFTemplate;
