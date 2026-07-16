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
  page: { padding: 36, paddingBottom: 48, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.35, color: '#000000' },
  documentHeader: { marginBottom: 20 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordContainer: { marginBottom: 18 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', paddingBottom: 5, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid', marginBottom: 12 },
  block: { marginBottom: 5 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid', marginBottom: 8 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid', marginBottom: 3 },
  subLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginBottom: 3 },
  itemLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginBottom: 3 },
  fieldValue: { fontSize: 14 },
  listItem: { fontSize: 14, paddingLeft: 10 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#000000' },
  pageNumber: { position: 'absolute', bottom: 20, right: 40, fontSize: 10, color: '#000000' },
});

/* ═══════ CONSTANTS ═══════ */
const SECTION_TITLES = {
  'general': 'General Information',
  'trends': 'Trends',
  'clinical': 'Clinical',
  'notes': 'Notes',
};
const FIELD_LABELS = {
  date: 'Date', type: 'Type', provider: 'Provider', facility: 'Facility',
  laboratoryTrends: 'Laboratory Trends', vitalSignTrends: 'Vital Sign Trends',
  clinicalTrends: 'Clinical Trends', renalTrends: 'Renal Trends',
  findings: 'Findings', assessment: 'Assessment', plan: 'Plan',
  results: 'Results', recommendations: 'Recommendations', notes: 'Notes', status: 'Status',
};
const SECTION_FIELDS = {
  'general': ['date', 'type', 'provider', 'facility', 'status'],
  'trends': ['laboratoryTrends', 'vitalSignTrends', 'clinicalTrends', 'renalTrends'],
  'clinical': ['findings', 'assessment', 'plan', 'results', 'recommendations'],
  'notes': ['notes'],
};
const SECTION_ORDER = ['general', 'trends', 'clinical', 'notes'];
const DATE_FIELDS = ['date'];
const STRING_FIELDS = ['type', 'provider', 'facility', 'findings', 'assessment', 'plan', 'notes', 'status'];
const ENUM_OPTIONS = { status: ['Completed', 'Active', 'Pending', 'Reviewed'] };
const COMMA_PATHS = ['clinicalTrends.symptomProgression', 'clinicalTrends.medicationResponse', 'clinicalTrends.diseaseControl'];
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
const displaySubfieldValue = (key, value) => key === 'trend'
  ? String(value ?? '').replace(/^↓\s*/, 'Decreasing - ').replace(/^↑\s*/, 'Increasing - ').replace(/^→\s*/, 'Stable - ')
  : fmtScalar(value);

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
const enumCanonical = (field, current) => { const value = String(current ?? ''); return (ENUM_OPTIONS[field] || []).find(o => o.toLowerCase() === value.toLowerCase()) || value; };
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?:;\s+|(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\b[A-Z])(?<!\d)\.\s+)/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); };
const splitGuardedComma = (text) => {
  const source = String(text || ''); const parts = []; let current = ''; let depth = 0;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if ('([{'.includes(char)) { depth += 1; current += char; continue; }
    if (')]}'.includes(char)) { depth = Math.max(0, depth - 1); current += char; continue; }
    if (char !== ',' || depth > 0) { current += char; continue; }
    const before = current.trim(); const after = source.slice(index + 1); const trimmed = after.trimStart();
    const nextWord = (trimmed.match(/^([A-Za-z]+)/) || [])[1]?.toLowerCase(); const previousWord = (before.match(/([A-Za-z]+)$/) || [])[1]?.toLowerCase();
    const protectedComma = (/\d$/.test(before) && /^\d{3}\b/.test(trimmed)) || after.length === trimmed.length || ['and', 'or', 'then'].includes(nextWord) || ['and', 'or'].includes(previousWord);
    if (protectedComma) current += char; else { if (before) parts.push(before); current = ''; }
  }
  if (current.trim()) parts.push(current.trim()); return parts.length ? parts : [source];
};

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
      <View key={field} style={styles.fieldGroup} wrap={false}>
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
      <View key={field} style={styles.fieldGroup} wrap={false}>
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
        <View key={`${field}-${k}`} style={styles.fieldGroup} wrap={false}>
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
      <View key={field} style={styles.fieldGroup} wrap={false}>
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

const recursiveBlocks = (value, basePath) => {
  if (!hasVal(value)) return [];
  if (isScalar(value)) {
    const shown = fmtScalar(value);
    const rows = COMMA_PATHS.includes(basePath) ? splitGuardedComma(shown) : [shown];
    return rows.map((row, index) => ({
      key: `${basePath}-${index}`,
      subLabel: index === 0 ? humanizeKey(String(basePath).split('.').pop()) : '',
      value: row,
      rowNumber: rows.length > 1 ? index + 1 : undefined,
    }));
  }
  if (Array.isArray(value)) {
    return value.filter(hasVal).flatMap((item, index) => {
      if (isScalar(item)) return [{ key: `${basePath}-${index}`, subLabel: index === 0 ? humanizeKey(String(basePath).split('.').pop()) : '', value: fmtScalar(item), rowNumber: index + 1 }];
      return recursiveBlocks(item, `${basePath}.${index}`).map((block, blockIndex) => ({ ...block, itemLabel: blockIndex === 0 ? `Item ${index + 1}` : '' }));
    });
  }
  return Object.entries(value).flatMap(([key, child]) => recursiveBlocks(child, `${basePath}.${key}`));
};

const laboratoryBlocks = (items) => (Array.isArray(items) ? items : []).flatMap((item, itemIndex) =>
  (OBJECT_SUBFIELDS.laboratoryTrends || []).filter(({ key }) => hasVal(item?.[key])).map(({ key, label }, subIndex) => ({
    key: `laboratoryTrends-${itemIndex}-${key}`,
    itemLabel: subIndex === 0 ? `Laboratory Trend ${itemIndex + 1}` : '',
    subLabel: label,
    value: displaySubfieldValue(key, item[key]),
  })));

const narrativeBlocks = (field, value, title) => {
  if (!hasVal(value)) return [];
  const label = FIELD_LABELS[field] || humanizeKey(field);
  const showFieldLabel = label.toLowerCase() !== title.toLowerCase();
  const shown = ENUM_OPTIONS[field] ? enumCanonical(field, value) : fmtVal(value);
  const rows = DATE_FIELDS.includes(field) ? [formatDate(value)] : field === 'findings' ? splitBySentence(shown).flatMap(splitGuardedComma) : splitBySentence(shown);
  return rows.map((rawRow, index) => {
    let row = rawRow;
    let itemLabel = '';
    if (field === 'findings' && index === 0) {
      const overall = row.match(/^([^:]+):\s+(.+)$/);
      if (overall) { itemLabel = overall[1]; row = overall[2]; }
    }
    const phase = field === 'findings' ? row.match(/^([^:]+):\s+(.+)$/) : null;
    return {
      key: `${field}-${index}`,
      fieldLabel: index === 0 && showFieldLabel ? label : '',
      itemLabel,
      subLabel: phase?.[1] || '',
      value: phase?.[2] || row,
      rowNumber: rows.length > 1 ? index + 1 : undefined,
    };
  });
};

const recommendationBlocks = (items) => {
  const groups = [];
  (Array.isArray(items) ? items : []).forEach((item, index) => {
    const date = item?.date || '';
    let group = groups.find((entry) => entry.date === date);
    if (!group) { group = { date, items: [] }; groups.push(group); }
    group.items.push({ item, index });
  });
  return groups.flatMap((group) => {
    const blocks = group.date ? [{ key: `recommendation-date-${group.date}`, subLabel: 'Recommendation Date', value: formatDate(group.date) }] : [];
    group.items.forEach(({ item, index }, itemIndex) => { if (hasVal(item?.recommendation)) blocks.push({ key: `recommendation-${index}`, value: String(item.recommendation), rowNumber: itemIndex + 1 }); });
    return blocks;
  });
};

const sectionBlocks = (record, sid) => (SECTION_FIELDS[sid] || []).flatMap((field) => {
  const value = record[field];
  if (!hasVal(value)) return [];
  if (field === 'laboratoryTrends') return laboratoryBlocks(value).map((block, index) => ({ ...block, fieldLabel: index === 0 ? FIELD_LABELS[field] : '' }));
  if (field === 'recommendations') return recommendationBlocks(value).map((block, index) => ({ ...block, fieldLabel: index === 0 ? FIELD_LABELS[field] : '' }));
  if (OBJECT_FIELDS.includes(field)) return recursiveBlocks(value, field).map((block, index) => ({ ...block, fieldLabel: index === 0 ? FIELD_LABELS[field] : '' }));
  return narrativeBlocks(field, value, SECTION_TITLES[sid]);
});

const renderSectionBlocks = (sid, blocks) => blocks.map((block, index) => <View key={block.key} style={styles.block} wrap={false}>
  {index === 0 && <Text style={styles.sectionTitle}>{SECTION_TITLES[sid]}</Text>}
  {block.fieldLabel && <Text style={styles.fieldLabel}>{block.fieldLabel}</Text>}
  {block.itemLabel && <Text style={styles.itemLabel}>{block.itemLabel}</Text>}
  {block.subLabel && <Text style={styles.subLabel}>{block.subLabel}</Text>}
  <Text style={block.rowNumber ? styles.listItem : styles.fieldValue}>{block.rowNumber ? `${block.rowNumber}. ${block.value}` : block.value}</Text>
</View>);

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
    return (<Document><Page size="LETTER" style={styles.page}><View style={styles.documentHeader}><Text style={styles.documentTitle}>Trend Analysis</Text></View><Text style={styles.emptyState}>No records available</Text></Page></Document>);
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader} wrap={false}><Text style={styles.documentTitle}>Trend Analysis</Text></View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <View wrap={false}><Text style={styles.recordTitle}>{`Trend Analysis ${String(record._recordNumber || idx + 1)}`}</Text></View>
            {SECTION_ORDER.flatMap((sid) => renderSectionBlocks(sid, sectionBlocks(record, sid)))}
          </View>
        ))}
        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} fixed />
      </Page>
    </Document>
  );
};

export default TrendAnalysisDocumentPDFTemplate;
