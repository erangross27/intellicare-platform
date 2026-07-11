/**
 * TrendAnalysisDocumentPDFTemplate.jsx
 * June 2026 — Helvetica — A4 — BLACK & WHITE only (#000000 titles/borders/values, NO blue).
 * Collection: trend_analysis.
 *
 * BOX-FREE (no backgroundColor/border on field/section views; recordHeader = black bottom-border only).
 * Rule #74: each field is ONE wrap-gated <View> (rows<=8 -> wrap={false}; rows>8 -> wrap=undefined),
 * with its sectionTitle as the FIRST child of the first present field's View (anti-orphan — never a sibling).
 * Single-name skip: hide a field label when it equals the section title.
 * OBJECT fields (vitalSignTrends/clinicalTrends/renalTrends/results) rendered recursively as
 * humanized key/value lines. ARRAY fields (laboratoryTrends/recommendations) date-grouped numbered list.
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
  'trends': 'Trends',
  'clinical': 'Clinical',
  'notes-status': 'Notes & Status',
};
const FIELD_LABELS = {
  date: 'Date', provider: 'Provider', facility: 'Facility',
  laboratoryTrends: 'Laboratory Trends', vitalSignTrends: 'Vital Sign Trends',
  clinicalTrends: 'Clinical Trends', renalTrends: 'Renal Trends',
  findings: 'Findings', assessment: 'Assessment', plan: 'Plan',
  results: 'Results', recommendations: 'Recommendations', notes: 'Notes', status: 'Status',
};
const SECTION_FIELDS = {
  'trends': ['laboratoryTrends', 'vitalSignTrends', 'clinicalTrends', 'renalTrends'],
  'clinical': ['findings', 'assessment', 'plan', 'results', 'recommendations'],
  'notes-status': ['notes', 'status'],
};
const SECTION_ORDER = ['trends', 'clinical', 'notes-status'];
const DATE_FIELDS = ['date'];
const STRING_FIELDS = ['provider', 'facility', 'findings', 'assessment', 'plan', 'notes', 'status'];
const OBJECT_FIELDS = ['vitalSignTrends', 'clinicalTrends', 'renalTrends', 'results'];
const OBJECT_ARRAY_FIELDS = ['recommendations'];
const SUBFIELD_ARRAY_FIELDS = ['laboratoryTrends'];
const OBJECT_SUBFIELDS = {
  laboratoryTrends: [
    { key: 'test', label: 'Test' },
    { key: 'currentValue', label: 'Current Value' },
    { key: 'previousValue', label: 'Previous Value' },
    { key: 'trend', label: 'Trend' },
    { key: 'dateRange', label: 'Date Range' },
  ],
};
const formatObjectArrayItem = (item, fn) => {
  if (!item || typeof item !== 'object') return String(item ?? '');
  const defs = OBJECT_SUBFIELDS[fn];
  if (defs) return defs.filter(d => item[d.key] !== undefined && item[d.key] !== null && String(item[d.key]).trim() !== '').map(d => `${d.label}: ${item[d.key]}`).join(', ');
  return Object.entries(item).filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '').map(([k, v]) => `${humanizeKey(k)}: ${v}`).join(', ');
};

const KEY_OVERRIDES = {
  bun: 'BUN', gfr: 'GFR', egfr: 'eGFR', creatinine: 'Creatinine', bp: 'BP', hr: 'HR',
  rr: 'RR', spo2: 'SpO2', wbc: 'WBC', rbc: 'RBC', hgb: 'Hgb', hct: 'Hct', plt: 'Plt',
  ckd: 'CKD', aki: 'AKI', ckmb: 'CK-MB', bnp: 'BNP', inr: 'INR', ptt: 'PTT',
};
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

/* recursive object node: label = bold heading; value = plain line below (NO inline "Label: value") */
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

  if (SUBFIELD_ARRAY_FIELDS.includes(field)) {
    const items = (Array.isArray(val) ? val : []).filter(it => !isEmptyDeep(it));
    if (items.length === 0) return [];
    return [(
      <View key={field} style={styles.fieldGroup} wrap={items.length > 8 ? undefined : false}>
        {titleNode}
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        {items.map((it, i) => (<Text key={i} style={styles.value}>{i + 1}. {formatObjectArrayItem(it, field)}</Text>))}
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

  /* string — split into sentences */
  const strVal = fmtVal(val);
  const sentences = splitBySentence(strVal);
  if (sentences.length > 1) {
    return [(
      <View key={field} style={styles.fieldGroup} wrap={sentences.length > 8 ? undefined : false}>
        {titleNode}
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        {sentences.map((s, sIdx) => (<Text key={sIdx} style={styles.value}>{sIdx + 1}. {s}</Text>))}
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

const TrendAnalysisDocumentPDFTemplate = ({ document: data }) => {
  let records = [];
  if (Array.isArray(data)) {
    if (data.length === 1 && data[0]?.trend_analysis) records = Array.isArray(data[0].trend_analysis) ? data[0].trend_analysis : [data[0].trend_analysis];
    else records = data;
  } else if (data?.trend_analysis) records = Array.isArray(data.trend_analysis) ? data.trend_analysis : [data.trend_analysis];
  else if (data?.documentData) { const dd = data.documentData; if (Array.isArray(dd)) records = dd; else if (dd?.trend_analysis) records = Array.isArray(dd.trend_analysis) ? dd.trend_analysis : [dd.trend_analysis]; else if (dd && typeof dd === 'object') records = [dd]; }
  else if (data && typeof data === 'object') records = [data];
  records = (records || []).filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (<Document><Page size="A4" style={styles.page}><View style={styles.documentHeader}><Text style={styles.title}>Trend Analysis</Text></View><Text style={styles.emptyState}>No records available</Text></Page></Document>);
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Trend Analysis</Text></View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`Trend Analysis ${String(record._recordNumber || idx + 1)}`}</Text>
              {hasVal(record.date) && <Text style={styles.recordMeta}>{formatDate(record.date)}</Text>}
              {hasVal(record.provider) && <Text style={styles.recordMeta}>{fmtVal(record.provider)}</Text>}
              {hasVal(record.facility) && <Text style={styles.recordMeta}>{fmtVal(record.facility)}</Text>}
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
          </View>
        ))}
        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} fixed />
      </Page>
    </Document>
  );
};

export default TrendAnalysisDocumentPDFTemplate;
