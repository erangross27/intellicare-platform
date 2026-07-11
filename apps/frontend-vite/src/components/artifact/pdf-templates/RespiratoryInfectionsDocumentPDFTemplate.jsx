/**
 * RespiratoryInfectionsDocumentPDFTemplate.jsx
 * June 2026 — Helvetica — A4 — BLACK & WHITE ONLY (#000000 titles/borders, no blue) — BOX-FREE.
 * Collection: respiratory_infections
 *
 * Mirrors the on-screen template. Narrative strings split per-sentence (./;); array-of-strings →
 * numbered rows; recommendations → date-grouped; objects + arrays-of-objects recurse via renderNode
 * (humanizeKey, hide-empty everywhere). Single-name skip: field label hidden when == section title.
 * Page-break Rule #74: each section is ONE wrap-gated <View> with its title as the FIRST CHILD;
 * wrap={itemCount > 8 ? undefined : false}. Only the record header is unconditionally wrap={false}.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, lineHeight: 1.5, backgroundColor: '#ffffff', color: '#000000' },
  header: { fontSize: 20, fontFamily: 'Helvetica-Bold', marginBottom: 20, textAlign: 'center', color: '#000000', borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid', paddingBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
  recordContainer: { marginBottom: 24 },
  recordHeader: { paddingBottom: 8, marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 4 },
  recordDate: { fontSize: 11, color: '#000000' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  field: { marginBottom: 8 },
  fieldLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3, textTransform: 'uppercase' },
  subLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 1 },
  value: { fontSize: 11, lineHeight: 1.5, color: '#000000', marginBottom: 1 },
  nested: { marginLeft: 10, paddingLeft: 8, marginTop: 2 },
  pageNumber: { position: 'absolute', bottom: 20, right: 40, fontSize: 10, color: '#9ca3af' },
});

/* ═══════ CONSTANTS ═══════ */
const SECTION_TITLES = {
  'overview': 'Overview',
  'current-infection': 'Current Infection',
  'infection-history': 'Infection History',
  'immunization-tb': 'Immunizations & TB Risk',
  'findings-plan': 'Findings & Plan',
  'results-section': 'Results',
  'recommendations-section': 'Recommendations',
};
const FIELD_LABELS = {
  date: 'Date', type: 'Type', provider: 'Provider', facility: 'Facility', status: 'Status',
  currentInfection: 'Current Infection', recurrentInfections: 'Recurrent Infections',
  pneumoniaHistory: 'Pneumonia History', tuberculosisRisk: 'Tuberculosis Risk', immunizations: 'Immunizations',
  findings: 'Findings', assessment: 'Assessment', plan: 'Plan', notes: 'Notes', results: 'Results', recommendations: 'Recommendations',
};
const SECTION_FIELDS = {
  'overview': ['date', 'type', 'provider', 'facility', 'status'],
  'current-infection': ['currentInfection'],
  'infection-history': ['recurrentInfections', 'pneumoniaHistory'],
  'immunization-tb': ['immunizations', 'tuberculosisRisk'],
  'findings-plan': ['findings', 'assessment', 'plan', 'notes'],
  'results-section': ['results'],
  'recommendations-section': ['recommendations'],
};
const DATE_FIELDS = ['date'];
const STRING_FIELDS = ['type', 'provider', 'facility', 'status', 'tuberculosisRisk', 'findings', 'assessment', 'plan', 'notes'];
const OBJECT_FIELDS = ['currentInfection', 'immunizations', 'results'];
const OBJECT_ARRAY_DISPLAY_FIELDS = ['recurrentInfections'];
const STRING_ARRAY_FIELDS = ['pneumoniaHistory'];
const RECOMMENDATIONS_FIELDS = ['recommendations'];

/* ═══════ HELPERS ═══════ */
const humanizeKey = (key) => { if (key === null || key === undefined || key === '') return ''; const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2'); return s.charAt(0).toUpperCase() + s.slice(1); };
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

/* count leaf rows for the wrap heuristic */
const countRows = (val) => {
  if (isEmptyDeep(val)) return 0;
  if (isScalar(val)) return 1;
  if (Array.isArray(val)) { let n = 0; val.filter(x => !isEmptyDeep(x)).forEach(it => { n += isScalar(it) ? 1 : 1 + countRows(it); }); return n; }
  let n = 0; Object.values(val).forEach(sub => { if (!isEmptyDeep(sub)) n += isScalar(sub) ? 2 : 1 + countRows(sub); }); return n;
};

/* recursive node: label = bold heading on its own line; value = plain line(s) below */
const renderNode = (label, value, keyPath, depth) => {
  if (isEmptyDeep(value)) return null;
  const LabelTag = depth > 0 ? styles.subLabel : styles.fieldLabel;

  if (isScalar(value)) {
    return (<View key={keyPath}>{label ? <Text style={LabelTag}>{label}</Text> : null}<Text style={styles.value}>{fmtScalar(value)}</Text></View>);
  }

  if (Array.isArray(value)) {
    const items = value.filter(x => !isEmptyDeep(x));
    if (items.length === 0) return null;
    return (
      <View key={keyPath}>
        {label ? <Text style={LabelTag}>{label}</Text> : null}
        {items.map((item, i) => {
          const ik = `${keyPath}-${i}`;
          if (isScalar(item)) return <Text key={ik} style={styles.value}>{fmtScalar(item)}</Text>;
          const entries = Object.entries(item).filter(([, v]) => !isEmptyDeep(v));
          if (entries.length === 0) return null;
          const headScalar = isScalar(entries[0][1]);
          const head = headScalar ? fmtScalar(entries[0][1]) : null;
          const rest = entries.slice(1);
          if (head !== null && rest.length === 0) return <Text key={ik} style={styles.value}>{head}</Text>;
          if (head !== null && rest.length === 1 && isScalar(rest[0][1])) {
            return (<View key={ik}><Text style={styles.subLabel}>{head}</Text><Text style={styles.value}>{fmtScalar(rest[0][1])}</Text></View>);
          }
          return (
            <View key={ik}>
              {head !== null ? <Text style={styles.subLabel}>{head}</Text> : null}
              <View style={styles.nested}>{(head !== null ? rest : entries).map(([k, v]) => renderNode(humanizeKey(k), v, `${ik}-${k}`, depth + 2))}</View>
            </View>
          );
        })}
      </View>
    );
  }

  const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
  if (entries.length === 0) return null;
  return (
    <View key={keyPath}>
      {label ? <Text style={LabelTag}>{label}</Text> : null}
      <View style={label ? styles.nested : undefined}>{entries.map(([k, v]) => renderNode(humanizeKey(k), v, `${keyPath}-${k}`, depth + 1))}</View>
    </View>
  );
};

const RespiratoryInfectionsDocumentPDFTemplate = ({ document: data }) => {
  const unwrapData = (inputData) => {
    if (!inputData) return [];
    if (Array.isArray(inputData)) {
      if (inputData.length === 1 && inputData[0]?.respiratory_infections) return inputData[0].respiratory_infections;
      return inputData;
    }
    if (inputData.respiratory_infections) return inputData.respiratory_infections;
    if (inputData.documentData) { const dd = inputData.documentData; if (Array.isArray(dd)) return dd; if (dd?.respiratory_infections) return Array.isArray(dd.respiratory_infections) ? dd.respiratory_infections : [dd.respiratory_infections]; return [dd]; }
    return [inputData];
  };
  let records = unwrapData(data);
  records = (records || []).filter(r => r && typeof r === 'object');

  // Render a single field inside a section. sectionTitle is rendered by the parent View.
  const renderField = (record, field, sectionTitle) => {
    const val = record[field];
    if (!hasVal(val)) return null;
    const label = FIELD_LABELS[field] || field;
    // Single-name skip: hide the field label when it equals the section title.
    const showLabel = label.trim().toLowerCase() !== (sectionTitle || '').trim().toLowerCase();

    if (DATE_FIELDS.includes(field)) {
      return (<View key={field} style={styles.field}>{showLabel && <Text style={styles.fieldLabel}>{label}</Text>}<Text style={styles.value}>{formatDate(val)}</Text></View>);
    }

    // Recommendations — array of {recommendation, date}: group consecutive same-date items.
    if (RECOMMENDATIONS_FIELDS.includes(field)) {
      const recs = Array.isArray(val) ? val : [];
      if (recs.length === 0) return null;
      const groups = [];
      recs.forEach((r) => { const d = (r?.date || '').trim(); const last = groups[groups.length - 1]; if (last && last.date === d) last.items.push(r); else groups.push({ date: d, items: [r] }); });
      return (
        <View key={field} style={styles.field}>
          {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
          {groups.map((group, gIdx) => (
            <View key={gIdx}>
              {group.date ? <Text style={styles.subLabel}>{group.date}</Text> : null}
              {group.items.map((r, i) => (<Text key={i} style={styles.value}>{i + 1}. {(r?.recommendation || '').trim()}</Text>))}
            </View>
          ))}
        </View>
      );
    }

    // Array of strings — numbered rows.
    if (STRING_ARRAY_FIELDS.includes(field)) {
      const items = (Array.isArray(val) ? val : []).filter(x => hasVal(x));
      if (items.length === 0) return null;
      return (<View key={field} style={styles.field}>{showLabel && <Text style={styles.fieldLabel}>{label}</Text>}{items.map((it, i) => (<Text key={i} style={styles.value}>{i + 1}. {fmtVal(it)}</Text>))}</View>);
    }

    // Object / array-of-objects — recurse.
    if (OBJECT_FIELDS.includes(field) || OBJECT_ARRAY_DISPLAY_FIELDS.includes(field)) {
      return (<View key={field} style={styles.field}>{showLabel && <Text style={styles.fieldLabel}>{label}</Text>}{renderNode('', val, field, 0)}</View>);
    }

    // String field — split into sentences.
    const strVal = fmtVal(val);
    const sentences = splitBySentence(strVal);
    if (sentences.length > 1) {
      return (<View key={field} style={styles.field}>{showLabel && <Text style={styles.fieldLabel}>{label}</Text>}{sentences.map((s, i) => (<Text key={i} style={styles.value}>{i + 1}. {s}</Text>))}</View>);
    }
    return (<View key={field} style={styles.field}>{showLabel && <Text style={styles.fieldLabel}>{label}</Text>}<Text style={styles.value}>{strVal}</Text></View>);
  };

  // wrap-gating item count for a section (heaviest field's row count vs field count).
  const sectionItemCount = (record, presentFields) => {
    let max = presentFields.length;
    presentFields.forEach(f => {
      const val = record[f];
      if (RECOMMENDATIONS_FIELDS.includes(f) && Array.isArray(val)) max = Math.max(max, val.length);
      else if (STRING_ARRAY_FIELDS.includes(f) && Array.isArray(val)) max = Math.max(max, val.length);
      else if (OBJECT_FIELDS.includes(f) || OBJECT_ARRAY_DISPLAY_FIELDS.includes(f)) max = Math.max(max, countRows(val));
      else if (STRING_FIELDS.includes(f)) max = Math.max(max, splitBySentence(fmtVal(val)).length);
    });
    return max;
  };

  if (records.length === 0) {
    return (<Document><Page size="A4" style={styles.page}><Text style={styles.header}>Respiratory Infections</Text></Page></Document>);
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.header}>Respiratory Infections</Text>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>Respiratory Infections {String(record._recordNumber || idx + 1)}</Text>
              {hasVal(record.date) && (<Text style={styles.recordDate}>{formatDate(record.date)}</Text>)}
            </View>
            {/* Sections — Rule #74: each section is ONE wrap-gated View with sectionTitle as FIRST CHILD */}
            {Object.keys(SECTION_FIELDS).map((sid) => {
              const fields = SECTION_FIELDS[sid];
              const presentFields = fields.filter(f => hasVal(record[f]));
              if (presentFields.length === 0) return null;
              const itemCount = sectionItemCount(record, presentFields);
              return (
                <View key={sid} style={styles.section} wrap={itemCount > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>{SECTION_TITLES[sid]}</Text>
                  {presentFields.map(f => renderField(record, f, SECTION_TITLES[sid]))}
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

export default RespiratoryInfectionsDocumentPDFTemplate;
