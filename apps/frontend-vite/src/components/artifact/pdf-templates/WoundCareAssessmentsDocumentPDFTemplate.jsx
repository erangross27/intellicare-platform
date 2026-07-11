import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * WoundCareAssessmentsDocumentPDFTemplate.jsx
 * June 2026 — rebuilt to the nested-subtitle + numbered-content pattern.
 * Each field renders as: section title -> field label (subtitle) -> value/sub-items
 * indented below (numbered for lists). NO "Label: value" side-by-side rows.
 * Page-break rule (memory 6a2d6af6): recordHeader is the only wrap={false};
 * each field is one View with wrap={rows.length > 8 ? undefined : false}; the
 * section title rides INSIDE the first present field's View (anti-orphan).
 */

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 11, lineHeight: 1.5, backgroundColor: '#ffffff', color: '#000000' },
  header: { marginBottom: 20, borderBottomWidth: 2, borderBottomColor: '#000000', paddingBottom: 10 },
  title: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 4 },
  subtitle: { fontSize: 10, color: '#333333' },
  recordCard: { marginBottom: 18 },
  recordHeader: { marginBottom: 10, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: '#999999' },
  recordTitle: { fontSize: 15, fontFamily: 'Helvetica-Bold', color: '#000000' },
  recordDate: { fontSize: 10, color: '#333333', marginTop: 2 },
  fieldBlock: { marginBottom: 8 },
  sectionTitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 6, textTransform: 'uppercase' },
  nestedSubtitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 2 },
  subLabel: { fontSize: 10.5, fontFamily: 'Helvetica-Bold', color: '#222222', marginBottom: 2 },
  valueText: { fontSize: 11, color: '#000000', marginBottom: 2 },
  listItem: { fontSize: 11, color: '#000000', marginBottom: 2 },
  noData: { fontSize: 12, color: '#666666', textAlign: 'center', marginTop: 40 },
});

/* ======= UTILS ======= */
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr.$date || dateStr);
    if (isNaN(date.getTime())) return String(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return String(dateStr); }
};

const labelFor = (key) => String(key).replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();

const hasVal = (v) => {
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'boolean') return true;
  if (typeof v === 'number') return true;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v).filter(k => k !== '_id').length > 0;
  return true;
};

const fmtScalar = (v) => {
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return String(v);
  return String(v);
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.(?:\s+)/)
    .map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};

const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

/* splitByComma: parenthesis-aware (commas inside () stay) */
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

/* buildRows: flatten any value into row descriptors mirroring the on-screen
   nested-subtitle + value structure. depth 0 = field label (subtitle), deeper =
   sub-label. Lists/multi-sentence become numbered items. */
const buildRows = (label, value, depth, rows) => {
  if (!hasVal(value)) return;
  const labelKind = depth === 0 ? 'subtitle' : 'subLabel';

  if (Array.isArray(value)) {
    const allScalar = value.every(v => v === null || typeof v !== 'object');
    if (allScalar) {
      if (label) rows.push({ kind: labelKind, text: label, depth });
      value.filter(v => hasVal(v)).forEach((v, i) => rows.push({ kind: 'item', text: fmtScalar(v), num: i + 1, depth: depth + 1 }));
      return;
    }
    if (label) rows.push({ kind: labelKind, text: label, depth });
    value.forEach((item, i) => {
      if (item && typeof item === 'object') buildRows(`${label || 'Item'} ${i + 1}`, item, depth + 1, rows);
      else if (hasVal(item)) rows.push({ kind: 'item', text: fmtScalar(item), num: i + 1, depth: depth + 1 });
    });
    return;
  }

  if (typeof value === 'object') {
    if (label) rows.push({ kind: labelKind, text: label, depth });
    Object.entries(value).filter(([k, v]) => k !== '_id' && hasVal(v)).forEach(([k, v]) => buildRows(labelFor(k), v, depth + 1, rows));
    return;
  }

  /* scalar */
  if (label) rows.push({ kind: labelKind, text: label, depth });
  if (typeof value === 'string') {
    const parsed = parseLabel(value);
    if (parsed.isLabeled) {
      const items = splitByComma(parsed.value);
      if (items.length >= 2) {
        rows.push({ kind: 'subLabel', text: parsed.label, depth: depth + 1 });
        items.forEach((it, i) => rows.push({ kind: 'item', text: it, num: i + 1, depth: depth + 2 }));
        return;
      }
    }
    const sentences = splitBySentence(value);
    if (sentences.length > 1) { sentences.forEach((s, i) => rows.push({ kind: 'item', text: s, num: i + 1, depth: depth + 1 })); return; }
  }
  rows.push({ kind: 'value', text: fmtScalar(value), depth: depth + 1 });
};

const WoundCareAssessmentsDocumentPDFTemplate = ({ document: data }) => {
  let recordsArray;
  if (Array.isArray(data)) {
    recordsArray = data[0]?.wound_care_assessments || data;
  } else {
    recordsArray = data?.wound_care_assessments || (data?.documentData || data?.data || [data]);
  }
  if (!Array.isArray(recordsArray)) recordsArray = [recordsArray];
  recordsArray = recordsArray.filter(Boolean);

  /* render row descriptors -> Text elements with depth indentation */
  const renderRows = (rows) => rows.map((r, i) => {
    const ml = 10 * Math.max(0, r.depth);
    if (r.kind === 'subtitle') return <Text key={i} style={[styles.nestedSubtitle, { marginLeft: ml }]}>{r.text}</Text>;
    if (r.kind === 'subLabel') return <Text key={i} style={[styles.subLabel, { marginLeft: ml }]}>{r.text}</Text>;
    if (r.kind === 'item') return <Text key={i} style={[styles.listItem, { marginLeft: ml }]}>{`${r.num}. ${r.text}`}</Text>;
    return <Text key={i} style={[styles.valueText, { marginLeft: ml }]}>{r.text}</Text>;
  });

  /* one field -> one wrap-gated View; sectionTitle (if given) renders inside it */
  const renderFieldView = (label, value, sectionTitle, keyHint) => {
    if (!hasVal(value)) return null;
    const rows = [];
    buildRows(label, value, 0, rows);
    if (rows.length === 0) return null;
    const wrapProp = rows.length > 8 ? undefined : false;
    return (
      <View key={keyHint} style={styles.fieldBlock} wrap={wrapProp}>
        {sectionTitle ? <Text style={styles.sectionTitle}>{sectionTitle}</Text> : null}
        {renderRows(rows)}
      </View>
    );
  };

  /* a section -> array of field Views; sectionTitle injected into the FIRST present field */
  const renderSection = (sectionTitle, root, itemLabel, sid) => {
    if (!hasVal(root)) return null;
    let fields = [];
    if (Array.isArray(root)) {
      const allScalar = root.every(v => v === null || typeof v !== 'object');
      if (allScalar) {
        fields = [{ key: 'list', value: root, label: null }];
      } else {
        fields = root.map((item, i) => ({ key: i, value: item, label: `${itemLabel || 'Item'} ${i + 1}` }));
      }
    } else if (typeof root === 'object') {
      fields = Object.entries(root).filter(([k, v]) => k !== '_id' && hasVal(v)).map(([k, v]) => ({ key: k, value: v, label: labelFor(k) }));
    }
    const views = fields.map(f => renderFieldView(f.label, f.value, undefined, `${sid}-${f.key}`));
    const firstIdx = views.findIndex(v => v != null);
    if (firstIdx === -1) return null;
    views[firstIdx] = renderFieldView(fields[firstIdx].label, fields[firstIdx].value, sectionTitle, `${sid}-${fields[firstIdx].key}-t`);
    return views;
  };

  const SECTIONS = [
    { key: 'woundIdentification', title: 'Wound Identification' },
    { key: 'woundClassification', title: 'Wound Classification' },
    { key: 'woundMeasurements', title: 'Wound Measurements', itemLabel: 'Measurement' },
    { key: 'woundBedCharacteristics', title: 'Wound Bed Characteristics' },
    { key: 'exudate', title: 'Exudate' },
    { key: 'periwoundSkin', title: 'Periwound Skin' },
    { key: 'infectionAssessment', title: 'Infection Assessment' },
    { key: 'vascularAssessment', title: 'Vascular Assessment' },
    { key: 'neuropathyAssessment', title: 'Neuropathy Assessment' },
    { key: 'debridement', title: 'Debridement', itemLabel: 'Debridement' },
    { key: 'dressingRegimen', title: 'Dressing Regimen' },
    { key: 'offloading', title: 'Off-loading' },
    { key: 'adjunctiveTherapies', title: 'Adjunctive Therapies' },
    { key: 'healingProgress', title: 'Healing Progress', itemLabel: 'Assessment' },
    { key: 'amputationRisk', title: 'Amputation Risk' },
    { key: 'patientEducation', title: 'Patient Education' },
  ];

  if (recordsArray.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.header}><Text style={styles.title}>Wound Care Assessments</Text></View>
          <Text style={styles.noData}>No data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Wound Care Assessments</Text>
          <Text style={styles.subtitle}>
            Generated on {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </Text>
        </View>

        {recordsArray.map((record, idx) => (
          <View key={idx} style={styles.recordCard}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{record.woundIdentification?.woundNumber || `Wound Care Assessment ${idx + 1}`}</Text>
              {record.date && <Text style={styles.recordDate}>Date: {formatDate(record.date)}</Text>}
            </View>
            {SECTIONS.map(s => renderSection(s.title, record[s.key], s.itemLabel, `${idx}-${s.key}`))}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default WoundCareAssessmentsDocumentPDFTemplate;
