/**
 * PodiatryExaminationsDocumentPDFTemplate.jsx
 * June 2026 — Helvetica — A4 — BLACK & WHITE only (#000000 titles/borders, no blue).
 * Collection: podiatry_examinations
 *
 * Mirrors the on-screen template: a LABEL is a bold heading on its own line; a VALUE is a plain
 * line below it (NEVER "Label: value" inline, NO numbering). Deeply-nested objects recurse;
 * arrays-of-objects render each item as a sub-block (first field's value = sub-label, remaining
 * fields = value lines). hide-empty everywhere. Page-break rule #74: each section is ONE <View>
 * with its title inside + wrap={rows > 8 ? undefined : false}; only the record header is wrap={false}.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, lineHeight: 1.5, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 24, paddingBottom: 14, borderBottomWidth: 3, borderBottomColor: '#000000' },
  title: { fontSize: 20, fontFamily: 'Helvetica-Bold', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 2, color: '#000000' },
  recordContainer: { marginBottom: 24, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#000000' },
  recordHeader: { marginBottom: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000' },
  recordMeta: { fontSize: 11, color: '#000000', marginTop: 3 },
  section: { marginBottom: 16 },
  fieldGroup: { marginBottom: 8 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 2 },
  subLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 1 },
  value: { fontSize: 11, lineHeight: 1.5, color: '#000000', marginBottom: 1 },
  nested: { marginLeft: 10, paddingLeft: 8, borderLeftWidth: 1, borderLeftColor: '#000000', marginTop: 2 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#000000' },
});

const formatDate = (d) => { if (!d) return ''; try { const dt = new Date(d.$date || d); if (isNaN(dt.getTime())) return String(d); return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
const KEY_OVERRIDES = { iwgdfRiskCategory: 'IWGDF Risk Category', anklebrachialIndex: 'Ankle-Brachial Index', rightABI: 'Right ABI', leftABI: 'Left ABI', prominentMTHeads: 'Prominent MT Heads', dorsalisPedisPulse: 'Dorsalis Pedis Pulse', posteriorTibialPulse: 'Posterior Tibial Pulse', capillaryRefillTime: 'Capillary Refill Time' };
const humanizeKey = (key) => { if (key === null || key === undefined || key === '') return ''; if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key]; const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2'); return s.charAt(0).toUpperCase() + s.slice(1); };
const isEmptyDeep = (v) => {
  if (v === null || v === undefined) return true;
  if (typeof v === 'boolean') return false;
  if (typeof v === 'number') return !Number.isFinite(v) || v === 0;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0;
  if (typeof v === 'object') return Object.values(v).every(isEmptyDeep);
  return false;
};
const hasVal = (v) => !isEmptyDeep(v);
const isScalar = (v) => v === null || typeof v !== 'object';
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\bvs)\.(?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); };

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
    return (
      <View key={keyPath}>
        {label ? <Text style={LabelTag}>{label}</Text> : null}
        <Text style={styles.value}>{fmtScalar(value)}</Text>
      </View>
    );
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

/* Rule #74: gate wrap PER TOP-LEVEL FIELD on that field's OWN row count; sectionTitle INSIDE the
   first field's View (never a standalone sibling -> would orphan). Each field's View is one wrap unit:
   rows<=8 -> wrap={false} (moves whole block to next page intact, never overprints);
   rows>8 -> wrap=undefined (long narrative flows/breaks across pages). Box-free. */
const renderSection = (sectionTitle, fieldVal, keyPath) => {
  if (isEmptyDeep(fieldVal)) return null;
  const isObj = fieldVal && typeof fieldVal === 'object' && !Array.isArray(fieldVal);
  if (isObj) {
    const entries = Object.entries(fieldVal).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return null;
    return entries.map(([k, v], i) => {
      const rows = countRows(v);
      return (
        <View key={`${keyPath}-${k}`} style={styles.fieldGroup} wrap={rows > 8 ? undefined : false}>
          {i === 0 ? <Text style={styles.sectionTitle}>{sectionTitle}</Text> : null}
          {renderNode(humanizeKey(k), v, `${keyPath}-${k}`, 0)}
        </View>
      );
    });
  }
  const rows = countRows(fieldVal);
  return (
    <View style={styles.fieldGroup} wrap={rows > 8 ? undefined : false}>
      <Text style={styles.sectionTitle}>{sectionTitle}</Text>
      {renderNode('', fieldVal, keyPath, 0)}
    </View>
  );
};

const renderIndication = (text) => {
  if (isEmptyDeep(text)) return null;
  const sentences = splitBySentence(String(text));
  const rows = (sentences.length > 1 ? sentences : [String(text)]);
  return (
    <View style={styles.section} wrap={rows.length > 8 ? undefined : false}>
      <Text style={styles.sectionTitle}>Indication</Text>
      {rows.map((s, i) => <Text key={i} style={styles.value}>{s}</Text>)}
    </View>
  );
};

const PodiatryExaminationsDocumentPDFTemplate = ({ document: data }) => {
  let records = [];
  if (Array.isArray(data)) records = data;
  else if (data?.podiatry_examinations) records = Array.isArray(data.podiatry_examinations) ? data.podiatry_examinations : [data.podiatry_examinations];
  else if (data?.documentData) { const dd = data.documentData; if (Array.isArray(dd)) records = dd; else if (dd?.podiatry_examinations) records = Array.isArray(dd.podiatry_examinations) ? dd.podiatry_examinations : [dd.podiatry_examinations]; else if (dd && typeof dd === 'object') records = [dd]; }
  else if (data && typeof data === 'object') records = [data];
  records = (records || []).filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (<Document><Page size="A4" style={styles.page}><View style={styles.documentHeader}><Text style={styles.title}>Podiatry Examination</Text></View><Text style={styles.emptyState}>No records available</Text></Page></Document>);
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Podiatry Examination</Text></View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`Podiatry Examination ${idx + 1}`}</Text>
              {hasVal(record.date) && <Text style={styles.recordMeta}>{formatDate(record.date)}</Text>}
            </View>
            {renderIndication(record.indicationForExam)}
            {renderSection('Neuropathy Assessment', record.neuropathyAssessment, 'neuro')}
            {renderSection('Vascular Assessment', record.vascularAssessment, 'vasc')}
            {renderSection('Foot Structure & Deformities', record.footStructureDeformities, 'struct')}
            {renderSection('Skin Condition', record.skinCondition, 'skin')}
            {renderSection('Nail Condition', record.nailCondition, 'nail')}
            {renderSection('Footwear Assessment', record.footwearAssessment, 'footwear')}
            {renderSection('Risk Stratification', record.riskStratification, 'risk')}
            {renderSection('Treatment Plan', record.treatmentPlan, 'treat')}
            {renderSection('Patient Education', record.patientEducation, 'edu')}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default PodiatryExaminationsDocumentPDFTemplate;
