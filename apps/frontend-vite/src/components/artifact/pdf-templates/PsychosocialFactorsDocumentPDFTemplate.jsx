/**
 * PsychosocialFactorsDocumentPDFTemplate.jsx
 * Helvetica — LETTER size — psychosocial factors — B&W GRAYSCALE ONLY
 * Collection: psychosocial_factors
 *
 * Rule #74 per-field wrap-gating: each field renders as its own wrap-gated View;
 * the sectionTitle is embedded INSIDE the first present field's View (anti-orphan).
 * OBJECT field `results` rendered recursively as humanized key/value lines.
 * recommendations (array of {recommendation, date}) date-grouped numbered list.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, lineHeight: 1.5, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 24, paddingBottom: 14, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  title: { fontSize: 20, fontFamily: 'Helvetica-Bold', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1, color: '#000000' },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000' },
  recordMeta: { fontSize: 11, color: '#000000', marginTop: 3 },
  section: { marginBottom: 16 },
  fieldGroup: { marginBottom: 8 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 2, textTransform: 'uppercase' },
  subLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 1 },
  value: { fontSize: 11, lineHeight: 1.5, color: '#000000', marginBottom: 1 },
  nested: { marginLeft: 10, paddingLeft: 8, borderLeftWidth: 1, borderLeftColor: '#000000', borderLeftStyle: 'solid', marginTop: 2 },
  recDate: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#000000' },
  pageNumber: { position: 'absolute', bottom: 20, right: 40, fontSize: 10, color: '#000000' },
});

/* ═══════ CONSTANTS ═══════ */
const SECTION_TITLES = {
  'clinical-info': 'Clinical Information',
  'stressors': 'Stressors',
  'support': 'Support',
  'coping-strategies': 'Coping Strategies',
  'mental-health': 'Mental Health',
  'findings': 'Findings',
  'assessment': 'Assessment',
  'plan': 'Plan',
  'results-section': 'Results',
  'recommendations-section': 'Recommendations',
  'notes-status': 'Notes & Status',
};
const FIELD_LABELS = {
  date: 'Date', provider: 'Provider', facility: 'Facility',
  stressors: 'Stressors', support: 'Support', copingStrategies: 'Coping Strategies',
  mentalHealth: 'Mental Health', findings: 'Findings', assessment: 'Assessment',
  plan: 'Plan', results: 'Results', recommendations: 'Recommendations',
  notes: 'Notes', status: 'Status',
};
const SECTION_FIELDS = {
  'clinical-info': ['date', 'provider', 'facility'],
  'stressors': ['stressors'],
  'support': ['support'],
  'coping-strategies': ['copingStrategies'],
  'mental-health': ['mentalHealth'],
  'findings': ['findings'],
  'assessment': ['assessment'],
  'plan': ['plan'],
  'results-section': ['results'],
  'recommendations-section': ['recommendations'],
  'notes-status': ['notes', 'status'],
};
const SECTION_ORDER = ['clinical-info', 'stressors', 'support', 'coping-strategies', 'mental-health', 'findings', 'assessment', 'plan', 'results-section', 'recommendations-section', 'notes-status'];
const DATE_FIELDS = ['date'];
const OBJECT_FIELDS = ['results'];
const OBJECT_ARRAY_FIELDS = ['recommendations'];

const KEY_OVERRIDES = {};
const humanizeKey = (key) => { if (key === null || key === undefined || key === '') return ''; if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key]; const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2'); return s.charAt(0).toUpperCase() + s.slice(1); };

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
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))[.;](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); };

/* parseLabel: detect "Label: value" patterns (mirrors the JSX template) */
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

/* splitByComma: parenthesis-aware comma split (mirrors the JSX template) */
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) { const t = current.trim(); if (t) result.push(t); current = ''; }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

/* recursive object node: label = bold heading; value = plain line below */
const renderObjectNode = (label, value, keyPath, depth) => {
  if (isEmptyDeep(value)) return null;
  const LabelTag = depth > 0 ? styles.subLabel : styles.fieldLabel;
  if (isScalar(value)) {
    return (
      <View key={keyPath}>
        {label ? <Text style={LabelTag}>{label}</Text> : null}
        <Text style={styles.value}>{fmtScalar(value)}</Text>
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

/* count rows for the wrap heuristic */
const countRows = (val) => {
  if (isEmptyDeep(val)) return 0;
  if (isScalar(val)) return 1;
  if (Array.isArray(val)) { let n = 0; val.filter(x => !isEmptyDeep(x)).forEach(it => { n += isScalar(it) ? 1 : 1 + countRows(it); }); return n; }
  let n = 0; Object.values(val).forEach(sub => { if (!isEmptyDeep(sub)) n += isScalar(sub) ? 2 : 1 + countRows(sub); }); return n;
};

/* Rule #74 (per-field gating): render a field as wrap-gated View(s) — EACH View is one wrap unit.
   sectionTitle goes INSIDE the first View (isFirst) — never a sibling. Returns an ARRAY of Views. */
const renderField = (record, field, sectionTitle, isFirst) => {
  const val = record[field];
  if (!hasVal(val)) return [];
  const label = FIELD_LABELS[field] || field;
  const showLabel = label.trim().toLowerCase() !== (sectionTitle || '').trim().toLowerCase();
  const titleNode = isFirst ? <Text style={styles.sectionTitle}>{sectionTitle}</Text> : null;

  if (DATE_FIELDS.includes(field)) {
    return [(
      <View key={field} style={styles.fieldGroup} wrap={false}>
        {titleNode}
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        <Text style={styles.value}>{formatDate(val)}</Text>
      </View>
    )];
  }

  if (OBJECT_ARRAY_FIELDS.includes(field)) {
    const recs = Array.isArray(val) ? val : [];
    if (recs.length === 0) return [];
    const groups = [];
    recs.forEach((r) => { const d = (r?.date || '').trim(); const last = groups[groups.length - 1]; if (last && last.date === d) last.items.push(r); else groups.push({ date: d, items: [r] }); });
    return [(
      <View key={field} style={styles.fieldGroup} wrap={recs.length > 8 ? undefined : false}>
        {titleNode}
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        {groups.map((group, gIdx) => (
          <View key={gIdx}>
            {group.date ? <Text style={styles.recDate}>{group.date}</Text> : null}
            {group.items.map((r, i) => (<Text key={i} style={styles.value}>{i + 1}. {(r?.recommendation || '').trim()}</Text>))}
          </View>
        ))}
      </View>
    )];
  }

  if (OBJECT_FIELDS.includes(field)) {
    const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return [];
    return entries.map(([k, v], i) => {
      const rows = countRows(v);
      return (
        <View key={`${field}-${k}`} style={styles.fieldGroup} wrap={rows > 8 ? undefined : false}>
          {i === 0 ? titleNode : null}
          {i === 0 && showLabel ? <Text style={styles.fieldLabel}>{label}</Text> : null}
          {renderObjectNode(humanizeKey(k), v, `${field}-${k}`, 1)}
        </View>
      );
    });
  }

  /* string — split into sentences; "Label: a, b, c" → sub-label + comma-split numbered rows */
  const strVal = fmtVal(val);
  const sentences = splitBySentence(strVal);
  const singleParsed = sentences.length === 1 ? parseLabel(sentences[0]) : null;
  const useMulti = sentences.length > 1 || (!!singleParsed && singleParsed.isLabeled && splitByComma(singleParsed.value).length >= 2);
  if (useMulti) {
    // Gate wrap on the field's OWN row count (labeled comma-lists expand to label + N items).
    const rowCount = sentences.reduce((acc, s) => {
      const p = parseLabel(s);
      if (p.isLabeled) { const it = splitByComma(p.value); if (it.length >= 2) return acc + 1 + it.length; }
      return acc + 1;
    }, 0);
    return [(
      <View key={field} style={styles.fieldGroup} wrap={rowCount > 8 ? undefined : false}>
        {titleNode}
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        {sentences.map((s, sIdx) => {
          const p = parseLabel(s);
          if (p.isLabeled) {
            const items = splitByComma(p.value);
            if (items.length >= 2) {
              return (
                <View key={sIdx}>
                  <Text style={styles.subLabel}>{p.label}:</Text>
                  {items.map((ci, ciIdx) => (<Text key={ciIdx} style={styles.value}>{ciIdx + 1}. {ci}</Text>))}
                </View>
              );
            }
          }
          return <Text key={sIdx} style={styles.value}>{sIdx + 1}. {s}</Text>;
        })}
      </View>
    )];
  }
  return [(
    <View key={field} style={styles.fieldGroup} wrap={false}>
      {titleNode}
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      <Text style={styles.value}>{strVal}</Text>
    </View>
  )];
};

const PsychosocialFactorsDocumentPDFTemplate = ({ document: data }) => {
  let rawRecords = [];
  if (Array.isArray(data)) {
    if (data.length > 0 && data[0]?.records) rawRecords = data[0].records;
    else if (data.length > 0 && data[0]?._records) rawRecords = data[0]._records;
    else if (data.length === 1 && data[0]?.psychosocial_factors) rawRecords = Array.isArray(data[0].psychosocial_factors) ? data[0].psychosocial_factors : [data[0].psychosocial_factors];
    else rawRecords = data;
  } else if (data?.psychosocial_factors) {
    rawRecords = Array.isArray(data.psychosocial_factors) ? data.psychosocial_factors : [data.psychosocial_factors];
  } else if (data?.records) {
    rawRecords = data.records;
  } else if (data?._records) {
    rawRecords = data._records;
  } else if (data?.documentData) {
    const dd = data.documentData;
    if (Array.isArray(dd)) rawRecords = dd;
    else if (dd?.psychosocial_factors) rawRecords = Array.isArray(dd.psychosocial_factors) ? dd.psychosocial_factors : [dd.psychosocial_factors];
    else if (dd && typeof dd === 'object') rawRecords = [dd];
  } else if (data) {
    rawRecords = [data];
  }

  const records = (rawRecords || []).map(record => {
    if (!record || typeof record !== 'object') return record;
    const cleanRecord = {};
    for (const key of Object.keys(record)) {
      if (!key.startsWith('_')) cleanRecord[key] = record[key];
    }
    return cleanRecord;
  }).filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}><Text style={styles.title}>Psychosocial Factors</Text></View>
          <Text style={styles.emptyState}>No data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Psychosocial Factors</Text></View>

        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>Psychosocial Factor {idx + 1}</Text>
              {hasVal(record.date) && <Text style={styles.recordMeta}>{formatDate(record.date)}</Text>}
            </View>

            {/* Rule #74 (per-field gating): section View only provides spacing and always FLOWS.
                Each field is its own wrap-gated unit (via renderField), with the sectionTitle embedded
                INSIDE the first present field's View (anti-orphan). */}
            {SECTION_ORDER.map((sid) => {
              const fields = SECTION_FIELDS[sid];
              const presentFields = fields.filter(f => hasVal(record[f]));
              if (presentFields.length === 0) return null;
              const title = SECTION_TITLES[sid];
              return (
                <View key={sid} style={styles.section}>
                  {presentFields.flatMap((f, fi) => renderField(record, f, title, fi === 0))}
                </View>
              );
            })}

            {idx < records.length - 1 && <View style={styles.separator} />}
          </View>
        ))}
        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} fixed />
      </Page>
    </Document>
  );
};

export default PsychosocialFactorsDocumentPDFTemplate;
