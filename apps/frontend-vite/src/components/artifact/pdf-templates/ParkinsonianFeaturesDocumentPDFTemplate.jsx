import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * ParkinsonianFeaturesDocumentPDFTemplate - box-free canonical (LETTER)
 * Mirrors HematologyConsultationsDocumentPDFTemplate: no boxes, underline rules only
 * (documentTitle 2 / recordTitle+sectionTitle 1 / fieldLabel 0.5). Renders EVERY populated
 * field the JSX renders for JSX/PDF parity. Nested OBJECT fields (tremor, bradykinesia,
 * rigidity, posturalInstability, results) render via a generic recursive object renderer;
 * a nested read-only boolean leaf (rigidity.cogwheeling) is preserved as "Yes"/"No".
 * recommendations (array of {recommendation, date}) render as a date-grouped list.
 * safeString uses ONLY \uXXXX escapes (never literal non-ASCII glyphs).
 */

const styles = StyleSheet.create({
  page: { padding: 40, paddingBottom: 64, fontFamily: 'Helvetica', fontSize: 14, backgroundColor: '#ffffff', color: '#000000', lineHeight: 1.4 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', marginBottom: 16, paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', marginTop: 14, marginBottom: 10, paddingBottom: 5, borderBottomWidth: 1, borderBottomColor: '#000000' },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginTop: 10, marginBottom: 6, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000' },
  fieldWrap: { marginBottom: 8 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginTop: 6, marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  subLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginTop: 4, marginBottom: 2 },
  value: { fontSize: 14, paddingLeft: 8, marginBottom: 3, lineHeight: 1.4 },
  nested: { marginLeft: 10, paddingLeft: 8, marginTop: 2 },
  recDate: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginTop: 4, marginBottom: 2 },
  footer: { position: 'absolute', bottom: 24, left: 40, right: 40, fontSize: 9, color: '#666666', textAlign: 'center', borderTopWidth: 0.5, borderTopColor: '#cccccc', paddingTop: 6 },
  noData: { fontSize: 14, textAlign: 'center', marginTop: 40, color: '#666666' },
});

/* CONFIG (mirrors the JSX) */
const SECTION_ORDER = ['assessment-info', 'tremor', 'bradykinesia', 'rigidity', 'postural-instability', 'findings', 'assessment', 'plan', 'results', 'recommendations', 'notes-status'];

const SECTION_TITLES = {
  'assessment-info': 'Assessment Information',
  'tremor': 'Tremor',
  'bradykinesia': 'Bradykinesia',
  'rigidity': 'Rigidity',
  'postural-instability': 'Postural Instability',
  'findings': 'Findings',
  'assessment': 'Assessment',
  'plan': 'Plan',
  'results': 'Results',
  'recommendations': 'Recommendations',
  'notes-status': 'Notes & Status',
};

const FIELD_LABELS = {
  date: 'Date', provider: 'Provider', facility: 'Facility',
  tremor: 'Tremor', bradykinesia: 'Bradykinesia', rigidity: 'Rigidity', posturalInstability: 'Postural Instability',
  findings: 'Findings', assessment: 'Assessment', plan: 'Plan',
  results: 'Results', recommendations: 'Recommendations', notes: 'Notes', status: 'Status',
};

const SECTION_FIELDS = {
  'assessment-info': ['date', 'provider', 'facility'],
  'tremor': ['tremor'],
  'bradykinesia': ['bradykinesia'],
  'rigidity': ['rigidity'],
  'postural-instability': ['posturalInstability'],
  'findings': ['findings'],
  'assessment': ['assessment'],
  'plan': ['plan'],
  'results': ['results'],
  'recommendations': ['recommendations'],
  'notes-status': ['notes', 'status'],
};

const DATE_FIELDS = ['date'];
const OBJECT_FIELDS = ['tremor', 'bradykinesia', 'rigidity', 'posturalInstability', 'results'];
const OBJECT_ARRAY_FIELDS = ['recommendations'];

/* HELPERS (mirror the JSX) */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/[\u2018\u2019\u201B]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u00A0/g, ' ')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u2028\u2029\uFEFF]/g, '');
};

const KEY_OVERRIDES = { ef: 'EF', lvef: 'LVEF', ivc: 'IVC', bpm: 'BPM', hr: 'HR', mri: 'MRI', ct: 'CT', dat: 'DAT', updrs: 'UPDRS', mds: 'MDS' };
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key];
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); if (isNaN(d.getTime())) return String(dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};

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

const CLAUSE_OPENER = /^(if|when|while|unless|although|though|because|since|after|before|once|given|whether|should|as|until|provided|assuming|in case)\b/i;
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m && !CLAUSE_OPENER.test(m[1].trim())) return { isLabeled: true, label: m[1].trim(), value: m[2].trim().replace(/^\d+\.\s+/, '') };
  return { isLabeled: false, label: '', value: text };
};

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

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|[A-Z]))[.;](?:\s+)/).map(s => s.trim().replace(/^\d+\.\s+/, '')).filter(s => s && !/^[;.,!?]+$/.test(s));
};

const strip = (s) => safeString(s).replace(/^\s*\d+\.\s+/, '').replace(/[;.]+$/, '').trim();

/* sentenceRows: splitBySentence -> parseLabel -> splitByComma, decomposing nested "Label: value"
   comma items into their own sub-label (mirrors the JSX decomposition; never side-by-side). */
const sentenceRows = (text) => {
  const rows = [];
  splitBySentence(text).forEach(sentence => {
    const p = parseLabel(sentence);
    if (p.isLabeled) {
      const items = splitByComma(p.value);
      if (items.length >= 2) {
        rows.push({ type: 'sub', text: p.label });
        items.forEach(it => {
          const ip = parseLabel(it);
          if (ip.isLabeled) { rows.push({ type: 'sub', text: ip.label }); rows.push({ type: 'item', text: ip.value }); }
          else rows.push({ type: 'item', text: it });
        });
      } else {
        rows.push({ type: 'sub', text: p.label });
        rows.push({ type: 'item', text: p.value });
      }
    } else {
      rows.push({ type: 'item', text: sentence });
    }
  });
  return rows;
};

/* recursive object node: humanized key = bold subLabel; scalar value = plain line below.
   arrays render each item as its own line; a boolean leaf renders as "Yes"/"No". */
const renderObjectNode = (label, value, keyPath, depth) => {
  if (isEmptyDeep(value)) return null;
  const LabelTag = depth > 1 ? styles.subLabel : styles.subLabel;
  if (isScalar(value)) {
    return (
      <View key={keyPath}>
        {label ? <Text style={LabelTag}>{safeString(label)}</Text> : null}
        <Text style={styles.value}>{safeString(fmtScalar(value))}</Text>
      </View>
    );
  }
  if (Array.isArray(value)) {
    const items = value.filter(x => !isEmptyDeep(x));
    if (items.length === 0) return null;
    return (
      <View key={keyPath}>
        {label ? <Text style={LabelTag}>{safeString(label)}</Text> : null}
        <View style={label ? styles.nested : undefined}>
          {items.map((it, i) => (isScalar(it)
            ? <Text key={i} style={styles.value}>{safeString(fmtScalar(it))}</Text>
            : renderObjectNode('', it, `${keyPath}-${i}`, depth + 1)))}
        </View>
      </View>
    );
  }
  const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
  if (entries.length === 0) return null;
  return (
    <View key={keyPath}>
      {label ? <Text style={LabelTag}>{safeString(label)}</Text> : null}
      <View style={label ? styles.nested : undefined}>
        {entries.map(([k, v]) => renderObjectNode(humanizeKey(k), v, `${keyPath}-${k}`, depth + 1))}
      </View>
    </View>
  );
};

/* fieldBody: the value node(s) for a plain string/number/date field */
const fieldBody = (value) => {
  const rows = sentenceRows(String(value));
  if (rows.length === 0) return [<Text key="v" style={styles.value}>{safeString(String(value))}</Text>];
  return rows.map((r, i) => r.type === 'sub'
    ? <Text key={i} style={styles.subLabel}>{safeString(r.text)}</Text>
    : <Text key={i} style={styles.value}>{strip(r.text)}</Text>);
};

/* renderField: ONE wrap=false View per field; the sectionTitle rides INSIDE the first present
   field's View (anti-orphan - never a standalone sibling). Returns an ARRAY with one View. */
const renderField = (record, field, sectionTitle, isFirst) => {
  const val = record[field];
  if (!hasVal(val)) return [];
  const label = FIELD_LABELS[field] || field;
  const showLabel = label.trim().toLowerCase() !== (sectionTitle || '').trim().toLowerCase();
  const titleNode = isFirst ? <Text style={styles.sectionTitle}>{safeString(sectionTitle)}</Text> : null;

  if (DATE_FIELDS.includes(field)) {
    return [(
      <View key={field} style={styles.fieldWrap} wrap={false}>
        {titleNode}
        {showLabel && <Text style={styles.fieldLabel}>{safeString(label)}</Text>}
        <Text style={styles.value}>{safeString(formatDate(val))}</Text>
      </View>
    )];
  }

  if (OBJECT_ARRAY_FIELDS.includes(field)) {
    const recs = Array.isArray(val) ? val.filter(r => hasVal(r?.recommendation)) : [];
    if (recs.length === 0) return [];
    const groups = [];
    recs.forEach((r) => { const d = (r?.date || '').trim(); const last = groups[groups.length - 1]; if (last && last.date === d) last.items.push(r); else groups.push({ date: d, items: [r] }); });
    return [(
      <View key={field} style={styles.fieldWrap} wrap={false}>
        {titleNode}
        {showLabel && <Text style={styles.fieldLabel}>{safeString(label)}</Text>}
        {groups.map((group, gIdx) => (
          <View key={gIdx}>
            {group.date ? <Text style={styles.recDate}>{safeString(group.date)}</Text> : null}
            {group.items.map((r, i) => (<Text key={i} style={styles.value}>{`${i + 1}. ${safeString((r?.recommendation || '').trim())}`}</Text>))}
          </View>
        ))}
      </View>
    )];
  }

  if (OBJECT_FIELDS.includes(field)) {
    if (isScalar(val)) return [];
    const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return [];
    return [(
      <View key={field} style={styles.fieldWrap} wrap={false}>
        {titleNode}
        {showLabel && <Text style={styles.fieldLabel}>{safeString(label)}</Text>}
        {entries.map(([k, v]) => renderObjectNode(humanizeKey(k), v, `${field}-${k}`, 1))}
      </View>
    )];
  }

  /* plain string */
  return [(
    <View key={field} style={styles.fieldWrap} wrap={false}>
      {titleNode}
      {showLabel && <Text style={styles.fieldLabel}>{safeString(label)}</Text>}
      {fieldBody(fmtVal(val))}
    </View>
  )];
};

const ParkinsonianFeaturesDocumentPDFTemplate = ({ document: data }) => {
  let records = [];
  if (Array.isArray(data)) {
    if (data.length === 1 && data[0]?.parkinsonian_features) records = Array.isArray(data[0].parkinsonian_features) ? data[0].parkinsonian_features : [data[0].parkinsonian_features];
    else records = data;
  } else if (data?.parkinsonian_features) records = Array.isArray(data.parkinsonian_features) ? data.parkinsonian_features : [data.parkinsonian_features];
  else if (data?.documentData) { const dd = data.documentData; if (Array.isArray(dd)) records = dd; else if (dd?.parkinsonian_features) records = Array.isArray(dd.parkinsonian_features) ? dd.parkinsonian_features : [dd.parkinsonian_features]; else if (dd && typeof dd === 'object') records = [dd]; }
  else if (data && typeof data === 'object') records = [data];
  records = (records || []).filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Parkinsonian Features</Text>
          <Text style={styles.noData}>No parkinsonian features records available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Parkinsonian Features</Text>
        {records.map((record, rIdx) => (
          <View key={rIdx}>
            <Text style={styles.recordTitle} break={rIdx > 0}>{safeString(`Parkinsonian Features ${String(record._recordNumber || rIdx + 1)}`)}</Text>
            {SECTION_ORDER.map((sid) => {
              const fields = SECTION_FIELDS[sid] || [];
              const presentFields = fields.filter(f => hasVal(record[f]));
              if (presentFields.length === 0) return null;
              const title = SECTION_TITLES[sid];
              return (
                <View key={sid}>
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

export default ParkinsonianFeaturesDocumentPDFTemplate;
