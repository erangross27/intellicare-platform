/**
 * TriageDataDocumentPDFTemplate.jsx
 * June 2026 — Helvetica — LETTER — BLACK & WHITE only (#000000 titles/borders/values, NO blue).
 * Collection: triage_data.
 *
 * BOX-FREE (no backgroundColor/border on field/section views; record/doc headers = black bottom-border only).
 * Rule #74: each field is ONE wrap-gated <View> (rows<=8 -> wrap={false}; rows>8 -> wrap=undefined),
 * with its sectionTitle as the FIRST child of the first present field's View (anti-orphan — never a sibling).
 * Single-name skip: hide a field label when it equals the section title.
 * triageVitals + results (OBJECT) rendered recursively as humanized key/value lines.
 * recommendations (array of {recommendation, date}) date-grouped numbered list.
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
  nested: { marginLeft: 10, paddingLeft: 8, borderLeftWidth: 1, borderLeftColor: '#000000', marginTop: 2 },
  recDate: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#000000' },
  pageNumber: { position: 'absolute', bottom: 20, right: 40, fontSize: 10, color: '#000000' },
});

/* ═══════ CONSTANTS ═══════ */
const SECTION_TITLES = {
  'triage-info': 'Triage Information',
  'chief-complaint': 'Chief Complaint',
  'triage-vitals': 'Triage Vitals',
  'triage-assessment': 'Triage Assessment',
  'findings-section': 'Findings',
  'assessment-plan': 'Assessment & Plan',
  'results-section': 'Results',
  'recommendations-section': 'Recommendations',
  'notes-section': 'Notes',
};
const FIELD_LABELS = {
  arrivalTime: 'Arrival Time', triageTime: 'Triage Time', esiLevel: 'ESI Level',
  modeOfArrival: 'Mode of Arrival', triageNurse: 'Triage Nurse', date: 'Date', type: 'Type',
  provider: 'Provider', facility: 'Facility', status: 'Status', chiefComplaint: 'Chief Complaint',
  triageVitals: 'Triage Vitals', triageAssessment: 'Triage Assessment', findings: 'Findings',
  assessment: 'Assessment', plan: 'Plan', results: 'Results', recommendations: 'Recommendations', notes: 'Notes',
};
const SECTION_FIELDS = {
  'triage-info': ['arrivalTime', 'triageTime', 'esiLevel', 'modeOfArrival', 'triageNurse', 'date', 'type', 'provider', 'facility', 'status'],
  'chief-complaint': ['chiefComplaint'],
  'triage-vitals': ['triageVitals'],
  'triage-assessment': ['triageAssessment'],
  'findings-section': ['findings'],
  'assessment-plan': ['assessment', 'plan'],
  'results-section': ['results'],
  'recommendations-section': ['recommendations'],
  'notes-section': ['notes'],
};
const SECTION_ORDER = ['triage-info', 'chief-complaint', 'triage-vitals', 'triage-assessment', 'findings-section', 'assessment-plan', 'results-section', 'recommendations-section', 'notes-section'];
const DATE_FIELDS = ['date'];
const OBJECT_FIELDS = ['triageVitals', 'results'];
const OBJECT_ARRAY_FIELDS = ['recommendations'];
const ENUM_OPTIONS = {
  esiLevel: ['ESI Level 1 - Resuscitation', 'ESI Level 2 - Emergent', 'ESI Level 3 - Urgent', 'ESI Level 4 - Less Urgent', 'ESI Level 5 - Non-Urgent'],
  status: ['Completed', 'Active', 'Pending', 'Reviewed'],
};

const KEY_OVERRIDES = {
  bp: 'BP', hr: 'HR', rr: 'RR', spo2: 'SpO2', wbc: 'WBC', rbc: 'RBC', bmp: 'BMP', cbc: 'CBC', ecg: 'ECG', ekg: 'EKG', bun: 'BUN', inr: 'INR', crp: 'CRP', esr: 'ESR',
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
const enumCanonical = (field, current) => { const value = String(current ?? '').replace(/\s*[—–]\s*/g, ' - '); return (ENUM_OPTIONS[field] || []).find(o => o.toLowerCase() === value.toLowerCase()) || value; };
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?:;\s+|(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\b[A-Z])(?<!\d)\.\s+)/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); };
const splitByComma = (text) => {
  const source = String(text || ''); const parts = []; let current = ''; let depth = 0;
  for (const char of source) { if (char === '(') { depth += 1; current += char; } else if (char === ')') { depth = Math.max(0, depth - 1); current += char; } else if (char === ',' && depth === 0) { if (current.trim()) parts.push(current.trim()); current = ''; } else current += char; }
  if (current.trim()) parts.push(current.trim()); return parts.length ? parts : [source];
};
const splitFieldParts = (field, text) => {
  const source = String(text || '').trim(); if (!source) return [];
  if (field === 'chiefComplaint') return splitByComma(source).map(part => part.replace(/^and\s+/i, '').trim());
  if (field === 'triageAssessment') return splitBySentence(source).flatMap(part => /^Field GCS\b/i.test(part) ? splitByComma(part) : [part]);
  if (field === 'notes') { const match = source.match(/^(.*?)\s*\((.*)\)\.?$/); if (match) return [match[1].trim(), ...splitByComma(match[2]).map(part => part.replace(/^and\s+/i, '').trim())]; }
  return splitBySentence(source);
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
  if (isScalar(value)) return [{ key: basePath, subLabel: humanizeKey(String(basePath).split('.').pop()), value: fmtScalar(value) }];
  if (Array.isArray(value)) return value.filter(hasVal).flatMap((item, index) => isScalar(item)
    ? [{ key: `${basePath}-${index}`, subLabel: index === 0 ? humanizeKey(String(basePath).split('.').pop()) : '', value: fmtScalar(item), rowNumber: index + 1 }]
    : recursiveBlocks(item, `${basePath}.${index}`).map((block, blockIndex) => ({ ...block, itemLabel: blockIndex === 0 ? `Item ${index + 1}` : '' })));
  return Object.entries(value).flatMap(([key, child]) => recursiveBlocks(child, `${basePath}.${key}`));
};
const narrativeBlocks = (field, value, title) => {
  if (!hasVal(value)) return [];
  const label = FIELD_LABELS[field] || humanizeKey(field);
  const shown = ENUM_OPTIONS[field] ? enumCanonical(field, value) : fmtVal(value).replace(/[—–]/g, '-');
  const rows = DATE_FIELDS.includes(field) ? [formatDate(value)] : splitFieldParts(field, shown);
  return rows.map((row, index) => ({ key: `${field}-${index}`, fieldLabel: index === 0 && label.toLowerCase() !== title.toLowerCase() ? label : '', value: row, rowNumber: rows.length > 1 ? index + 1 : undefined }));
};
const recommendationBlocks = (items) => {
  const groups = [];
  (Array.isArray(items) ? items : []).forEach((item, index) => { const date = item?.date || ''; let group = groups.find(entry => entry.date === date); if (!group) { group = { date, items: [] }; groups.push(group); } group.items.push({ item, index }); });
  return groups.flatMap(group => {
    const blocks = group.date ? [{ key: `date-${group.date}`, subLabel: 'Recommendation Date', value: formatDate(group.date) }] : [];
    group.items.forEach(({ item, index }, itemIndex) => { if (hasVal(item?.recommendation)) blocks.push({ key: `recommendation-${index}`, value: String(item.recommendation), rowNumber: itemIndex + 1 }); });
    return blocks;
  });
};
const sectionBlocks = (record, sid) => (SECTION_FIELDS[sid] || []).flatMap(field => {
  const value = record[field]; if (!hasVal(value)) return [];
  if (field === 'recommendations') return recommendationBlocks(value).map((block, index) => ({ ...block, fieldLabel: index === 0 ? FIELD_LABELS[field] : '' }));
  if (OBJECT_FIELDS.includes(field)) return recursiveBlocks(value, field).map((block, index) => ({ ...block, fieldLabel: index === 0 && FIELD_LABELS[field] !== SECTION_TITLES[sid] ? FIELD_LABELS[field] : '' }));
  return narrativeBlocks(field, value, SECTION_TITLES[sid]);
});
const renderSectionBlocks = (sid, blocks) => blocks.map((block, index) => <View key={block.key} style={styles.block} wrap={false}>
  {index === 0 && <Text style={styles.sectionTitle}>{SECTION_TITLES[sid]}</Text>}
  {block.fieldLabel && <Text style={styles.fieldLabel}>{block.fieldLabel}</Text>}
  {block.itemLabel && <Text style={styles.itemLabel}>{block.itemLabel}</Text>}
  {block.subLabel && <Text style={styles.subLabel}>{block.subLabel}</Text>}
  <Text style={block.rowNumber ? styles.listItem : styles.fieldValue}>{block.rowNumber ? `${block.rowNumber}. ${block.value}` : block.value}</Text>
</View>);

const TriageDataDocumentPDFTemplate = ({ document: data }) => {
  let records = [];
  if (Array.isArray(data)) {
    if (data.length === 1 && data[0]?.triage_data) records = Array.isArray(data[0].triage_data) ? data[0].triage_data : [data[0].triage_data];
    else records = data;
  } else if (data?.triage_data) records = Array.isArray(data.triage_data) ? data.triage_data : [data.triage_data];
  else if (data?.documentData) { const dd = data.documentData; if (Array.isArray(dd)) records = dd; else if (dd?.triage_data) records = Array.isArray(dd.triage_data) ? dd.triage_data : [dd.triage_data]; else if (dd && typeof dd === 'object') records = [dd]; }
  else if (data && typeof data === 'object') records = [data];
  records = (records || []).filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (<Document><Page size="LETTER" style={styles.page}><View style={styles.documentHeader}><Text style={styles.documentTitle}>Triage Data</Text></View><Text style={styles.emptyState}>No data available</Text></Page></Document>);
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader} wrap={false}><Text style={styles.documentTitle}>Triage Data</Text></View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <View wrap={false}><Text style={styles.recordTitle}>{`Triage Data ${idx + 1}`}</Text></View>
            {SECTION_ORDER.flatMap(sid => renderSectionBlocks(sid, sectionBlocks(record, sid)))}
          </View>
        ))}
        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} fixed />
      </Page>
    </Document>
  );
};

export default TriageDataDocumentPDFTemplate;
