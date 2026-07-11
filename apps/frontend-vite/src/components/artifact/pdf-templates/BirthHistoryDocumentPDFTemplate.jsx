/**
 * BirthHistoryDocumentPDFTemplate.jsx
 * June 2026 — Helvetica — A4 — BLACK & WHITE ONLY (#000000 + grayscale; NO saturated colors).
 * Collection: birth_history.
 *
 * BOX-FREE (no backgroundColor/border on field/section views; recordHeader = black bottom-border only).
 * Rule #74: each field is ONE wrap-gated <View> (rows<=8 -> wrap={false}; rows>8 -> wrap=undefined),
 * with its sectionTitle as the FIRST child of the first present field's View (anti-orphan — never a sibling).
 * Single-name skip: hide a field label when it equals the section title.
 * BOOLEAN (nicuStay) -> Yes/No. OBJECT (apgarScores, results) rendered recursively.
 * ARRAY (complications, recommendations) supports plain strings & {recommendation,date} (date-grouped).
 * Narratives (findings/assessment/plan/notes) numbered per-sentence.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, lineHeight: 1.5, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 24, paddingBottom: 14, borderBottomWidth: 2, borderBottomColor: '#000000' },
  title: { fontSize: 20, fontFamily: 'Helvetica-Bold', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1, color: '#000000' },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000' },
  recordMeta: { fontSize: 11, color: '#000000', marginTop: 3 },
  section: { marginBottom: 16 },
  fieldGroup: { marginBottom: 8 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 2, textTransform: 'uppercase' },
  subLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 1 },
  value: { fontSize: 11, lineHeight: 1.5, color: '#000000', marginBottom: 1 },
  nested: { marginLeft: 10, paddingLeft: 8, borderLeftWidth: 1, borderLeftColor: '#000000', marginTop: 2 },
  recDate: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#000000' },
  pageNumber: { position: 'absolute', bottom: 20, right: 40, fontSize: 10, color: '#000000' },
});

/* ═══════ CONSTANTS ═══════ */
const SECTION_TITLES = {
  'birth-details': 'Birth Details',
  'apgar': 'APGAR Scores',
  'complications': 'Delivery Complications',
  'nicu': 'NICU Stay',
  'provider-info': 'Provider Information',
  'clinical': 'Clinical',
  'results-section': 'Results',
  'recommendations-section': 'Recommendations',
  'notes-status': 'Notes & Status',
};
const FIELD_LABELS = {
  date: 'Date', gestationalAge: 'Gestational Age', deliveryType: 'Delivery Type', birthWeight: 'Birth Weight',
  birthLength: 'Birth Length', headCircumference: 'Head Circumference', type: 'Type',
  apgarScores: 'APGAR Scores', complications: 'Delivery Complications', nicuStay: 'NICU Admission',
  nicuDuration: 'NICU Duration', provider: 'Provider', facility: 'Facility', findings: 'Findings',
  assessment: 'Assessment', plan: 'Plan', results: 'Results', recommendations: 'Recommendations',
  notes: 'Notes', status: 'Status',
};
const SECTION_FIELDS = {
  'birth-details': ['gestationalAge', 'deliveryType', 'birthWeight', 'birthLength', 'headCircumference', 'type'],
  'apgar': ['apgarScores'],
  'complications': ['complications'],
  'nicu': ['nicuStay', 'nicuDuration'],
  'provider-info': ['provider', 'facility'],
  'clinical': ['findings', 'assessment', 'plan'],
  'results-section': ['results'],
  'recommendations-section': ['recommendations'],
  'notes-status': ['notes', 'status'],
};
const SECTION_ORDER = ['birth-details', 'apgar', 'complications', 'nicu', 'provider-info', 'clinical', 'results-section', 'recommendations-section', 'notes-status'];
const DATE_FIELDS = ['date'];
const BOOLEAN_FIELDS = ['nicuStay'];
const SENTENCE_FIELDS = ['findings', 'assessment', 'plan', 'notes'];
const OBJECT_FIELDS = ['apgarScores', 'results'];
const ARRAY_FIELDS = ['complications', 'recommendations'];

const KEY_OVERRIDES = { apgar: 'APGAR', nicu: 'NICU', bpm: 'BPM', hr: 'HR' };
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

// IDENTICAL to BirthHistoryDocument.jsx splitClauses — split on commas AND sentence terminators
// (. ! ? ;), paren-aware; comma guarded (between digits / before year / before and-or); period
// decimal-safe + abbreviation-safe. Read-only here → returns string[].
const CLAUSE_ABBR = new Set(['mr', 'mrs', 'ms', 'dr', 'prof', 'rev', 'sr', 'jr', 'st', 'gen', 'col', 'sgt', 'lt', 'capt', 'vs', 'etc', 'no', 'approx', 'fig', 'dx', 'hx']);
const endsWithAbbrev = (buf) => { const m = String(buf).trim().match(/(\w+)$/); return m ? CLAUSE_ABBR.has(m[1].toLowerCase()) : false; };
const splitClauseTexts = (text) => {
  if (!text || typeof text !== 'string') return [];
  const s = text.trim(); const out = []; let buf = '', depth = 0;
  const flush = () => { const t = buf.replace(/^[\s.;,!?]+/, '').replace(/[\s.;,!?]+$/, '').trim(); if (t) out.push(t); buf = ''; };
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '(' || ch === '[' || ch === '{') { depth++; buf += ch; continue; }
    if (ch === ')' || ch === ']' || ch === '}') { if (depth > 0) depth--; buf += ch; continue; }
    const prev = s[i - 1] || '', next = s[i + 1] || '';
    let boundary = false;
    if (depth === 0) {
      if (ch === ',') { const rest = s.slice(i + 1).replace(/^\s+/, ''); boundary = !((/\d/.test(prev) && /\d/.test(next)) || /^\d{4}\b/.test(rest) || /^(?:and|or)\b/i.test(rest)); }
      else if (ch === '.' || ch === '!' || ch === '?' || ch === ';') boundary = (next === '' || /\s/.test(next)) && !(ch === '.' && /\d/.test(prev) && /\d/.test(next)) && !(ch === '.' && endsWithAbbrev(buf));
    }
    if (boundary) { flush(); while (i + 1 < s.length && /\s/.test(s[i + 1])) i++; continue; }
    buf += ch;
  }
  flush();
  return out;
};

const arrItemText = (item) => {
  if (item === null || item === undefined) return '';
  if (typeof item === 'string') return item;
  if (typeof item === 'object') return String(item.recommendation || item.complication || item.text || item.value || '');
  return String(item);
};
const arrItemDate = (item) => { if (item && typeof item === 'object') return String(item.date || ''); return ''; };

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

/* Rule #74 (per-field gating): render a field as wrap-gated View(s). sectionTitle goes INSIDE the first
   View (isFirst) — never a sibling. Returns an ARRAY of Views. */
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

  if (BOOLEAN_FIELDS.includes(field)) {
    return [(
      <View key={field} style={styles.fieldGroup} wrap={false}>
        {titleNode}
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        <Text style={styles.value}>{val ? 'Yes' : 'No'}</Text>
      </View>
    )];
  }

  if (ARRAY_FIELDS.includes(field)) {
    const arr = Array.isArray(val) ? val : [];
    if (arr.length === 0) return [];
    const groups = [];
    arr.forEach((it) => { const d = arrItemDate(it).trim(); const last = groups[groups.length - 1]; if (last && last.date === d) last.items.push(it); else groups.push({ date: d, items: [it] }); });
    return [(
      <View key={field} style={styles.fieldGroup} wrap={arr.length > 8 ? undefined : false}>
        {titleNode}
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        {groups.map((group, gIdx) => (
          <View key={gIdx}>
            {group.date ? <Text style={styles.recDate}>{group.date}</Text> : null}
            {group.items.map((it, i) => (<Text key={i} style={styles.value}>{i + 1}. {arrItemText(it).trim()}</Text>))}
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

  /* string — narrative fields split into numbered clauses (commas AND sentences); mirrors JSX */
  const strVal = fmtVal(val);
  const parts = SENTENCE_FIELDS.includes(field) ? splitClauseTexts(strVal) : [strVal];
  if (SENTENCE_FIELDS.includes(field) && parts.length > 1) {
    const head = <>{titleNode}{showLabel && <Text style={styles.fieldLabel}>{label}</Text>}</>;
    // <=8 clauses → atomic wrap={false}; >8 → boolean wrap with head+first row glued (orphan-proof, v4).
    if (parts.length <= 8) {
      return [(
        <View key={field} style={styles.fieldGroup} wrap={false}>
          {head}
          {parts.map((s, sIdx) => (<Text key={sIdx} style={styles.value}>{sIdx + 1}. {s}</Text>))}
        </View>
      )];
    }
    return [(
      <View key={field} style={styles.fieldGroup} wrap={true}>
        <View wrap={false}>{head}<Text style={styles.value}>1. {parts[0]}</Text></View>
        {parts.slice(1).map((s, sIdx) => (<Text key={sIdx + 1} style={styles.value}>{sIdx + 2}. {s}</Text>))}
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

const BirthHistoryDocumentPDFTemplate = ({ document: data }) => {
  let records = [];
  if (Array.isArray(data)) {
    if (data.length === 1 && data[0]?.birth_history) records = Array.isArray(data[0].birth_history) ? data[0].birth_history : [data[0].birth_history];
    else records = data;
  } else if (data?.birth_history) records = Array.isArray(data.birth_history) ? data.birth_history : [data.birth_history];
  else if (data?.documentData) { const dd = data.documentData; if (Array.isArray(dd)) records = dd; else if (dd?.birth_history) records = Array.isArray(dd.birth_history) ? dd.birth_history : [dd.birth_history]; else if (dd && typeof dd === 'object') records = [dd]; }
  else if (data && typeof data === 'object') records = [data];
  records = (records || []).filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (<Document><Page size="A4" style={styles.page}><View style={styles.documentHeader}><Text style={styles.title}>Birth History</Text></View><Text style={styles.emptyState}>No records available</Text></Page></Document>);
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Birth History</Text></View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`Birth History ${String(record._recordNumber || idx + 1)}`}</Text>
              {hasVal(record.date) && <Text style={styles.recordMeta}>{formatDate(record.date)}</Text>}
              {hasVal(record.provider) && <Text style={styles.recordMeta}>{fmtVal(record.provider)}</Text>}
              {hasVal(record.facility) && <Text style={styles.recordMeta}>{fmtVal(record.facility)}</Text>}
            </View>

            {/* Rule #74 (per-field gating): each field is its own wrap-gated unit (via renderField),
                with the sectionTitle embedded INSIDE the first present field's View (anti-orphan). */}
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
          </View>
        ))}
        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} fixed />
      </Page>
    </Document>
  );
};

export default BirthHistoryDocumentPDFTemplate;
