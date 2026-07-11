/**
 * EndocrineLabResultsDocumentPDFTemplate.jsx
 * July 2026 — box-free canonical — LETTER — BLACK & WHITE ONLY (#000000)
 * Collection: endocrine_lab_results. Mirrors EndocrineLabResultsDocument.jsx (4-area rule):
 * numbered value rows, section title rides INSIDE the first present field's glue View,
 * per-field wrap={false} anti-orphan, break={idx>0}. Every numeric analyte stored 0 is a
 * not-measured sentinel → hidden (no endocrine analyte reads exactly 0), matching the JSX.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 44, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.4, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 20 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', textAlign: 'center', paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordContainer: { paddingBottom: 18 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 12, paddingBottom: 6 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 10, marginBottom: 6, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldGroup: { marginBottom: 8 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  fieldValue: { fontSize: 14, lineHeight: 1.4, color: '#000000', marginBottom: 1 },
  noDataText: { fontSize: 14, color: '#000000', textAlign: 'center', marginTop: 40 },
});

/* ═══════ CONFIG (mirror JSX) ═══════ */
const SECTION_TITLES = {
  'session-info': 'Session Information',
  'thyroid-panel': 'Thyroid Panel',
  'metabolic-hormones': 'Metabolic & Adrenal Hormones',
  'minerals-reproductive': 'Minerals & Reproductive Hormones',
};
const FIELD_LABELS = {
  date: 'Date', provider: 'Provider', facility: 'Facility',
  thyroidStimulatingHormone: 'Thyroid Stimulating Hormone (TSH)', freeThyroxineT4: 'Free Thyroxine (T4)',
  freeTriiodothyronineT3: 'Free Triiodothyronine (T3)', thyroidPeroxidaseAntibody: 'Thyroid Peroxidase Antibody (TPO)',
  thyroglobulinAntibody: 'Thyroglobulin Antibody', hemoglobinA1c: 'Hemoglobin A1c (%)', fastingGlucose: 'Fasting Glucose (mg/dL)',
  cPeptide: 'C-Peptide (ng/mL)', cortisol: 'Cortisol (mcg/dL)', cortisolCollectionTime: 'Cortisol Collection Time',
  adrenocorticotropicHormone: 'ACTH (pg/mL)', insulinLikeGrowthFactor1: 'IGF-1 (ng/mL)', parathyroidHormone: 'Parathyroid Hormone (pg/mL)',
  serumCalcium: 'Serum Calcium (mg/dL)', ionizedCalcium: 'Ionized Calcium (mmol/L)', vitamin25OHD: 'Vitamin D 25-OH (ng/mL)',
  prolactin: 'Prolactin (ng/mL)', luteinizingHormone: 'Luteinizing Hormone (mIU/mL)', follicleStimulatingHormone: 'FSH (mIU/mL)',
  testosterone: 'Testosterone (ng/dL)', estradiol: 'Estradiol (pg/mL)', serumOsmolality: 'Serum Osmolality (mOsm/kg)',
};
const SECTION_FIELDS = {
  'session-info': ['date', 'provider', 'facility'],
  'thyroid-panel': ['thyroidStimulatingHormone', 'freeThyroxineT4', 'freeTriiodothyronineT3', 'thyroidPeroxidaseAntibody', 'thyroglobulinAntibody'],
  'metabolic-hormones': ['hemoglobinA1c', 'fastingGlucose', 'cPeptide', 'cortisol', 'cortisolCollectionTime', 'adrenocorticotropicHormone', 'insulinLikeGrowthFactor1'],
  'minerals-reproductive': ['parathyroidHormone', 'serumCalcium', 'ionizedCalcium', 'vitamin25OHD', 'prolactin', 'luteinizingHormone', 'follicleStimulatingHormone', 'testosterone', 'estradiol', 'serumOsmolality'],
};
const NUMBER_FIELDS = [
  'thyroidStimulatingHormone', 'freeThyroxineT4', 'freeTriiodothyronineT3', 'thyroidPeroxidaseAntibody', 'thyroglobulinAntibody',
  'hemoglobinA1c', 'fastingGlucose', 'cPeptide', 'cortisol', 'adrenocorticotropicHormone', 'insulinLikeGrowthFactor1',
  'parathyroidHormone', 'serumCalcium', 'ionizedCalcium', 'vitamin25OHD', 'prolactin', 'luteinizingHormone',
  'follicleStimulatingHormone', 'testosterone', 'estradiol', 'serumOsmolality',
];
const STRING_FIELDS = ['provider', 'facility', 'cortisolCollectionTime'];
const DATE_FIELDS = ['date'];
const isZeroSentinel = (fn, v) => NUMBER_FIELDS.includes(fn) && Number(v) === 0;

/* ═══════ UTILS ═══════ */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'string' ? val : String(val);
  str = str.replace(/µm/g, 'um').replace(/μm/g, 'um').replace(/°/g, ' deg')
    .replace(/±/g, '+/-').replace(/≥/g, '>=').replace(/≤/g, '<=')
    .replace(/→/g, '->').replace(/“/g, '"').replace(/”/g, '"')
    .replace(/‘/g, "'").replace(/’/g, "'").replace(/—/g, '-').replace(/–/g, '-');
  return str;
};
const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};
const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))[.;](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};
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

const fieldPresent = (record, fn) => {
  const v = record[fn];
  if (!hasVal(v)) return false;
  if (isZeroSentinel(fn, v)) return false;
  return true;
};

/* rows for a field → array of {sub?} | {value} (mirror JSX Copy numbering) */
const fieldRows = (record, fn) => {
  const val = record[fn];
  const rows = [];
  if (DATE_FIELDS.includes(fn)) {
    rows.push({ value: `1. ${formatDate(val)}` });
  } else if (STRING_FIELDS.includes(fn)) {
    const sentences = splitBySentence(fmtVal(val));
    if (sentences.length > 1) {
      let n = 1;
      sentences.forEach(s => {
        const parsed = parseLabel(s);
        if (parsed.isLabeled) {
          const parts = splitByComma(parsed.value);
          if (parts.length >= 2) { rows.push({ sub: safeString(parsed.label) }); parts.forEach(p => rows.push({ value: `${n++}. ${safeString(p)}` })); }
          else { rows.push({ value: `${n++}. ${safeString(s)}` }); }
        } else { rows.push({ value: `${n++}. ${safeString(s)}` }); }
      });
    } else {
      rows.push({ value: `1. ${safeString(fmtVal(val))}` });
    }
  } else {
    rows.push({ value: `1. ${safeString(fmtVal(val))}` });
  }
  return rows;
};

/* one field = one glue View (anti-orphan). sectionTitle rides the first present field. single-name gate. */
const renderField = (record, fn, sectionTitle, idx) => {
  const label = FIELD_LABELS[fn] || fn;
  const showLabel = label !== sectionTitle;
  const rows = fieldRows(record, fn);
  return (
    <View key={`${idx}-${fn}`} style={styles.fieldGroup} wrap={rows.length > 22 ? true : false}>
      {sectionTitle ? <Text style={styles.sectionTitle}>{sectionTitle}</Text> : null}
      {showLabel ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      {rows.map((r, i) => r.sub
        ? <Text key={i} style={styles.fieldLabel}>{r.sub}</Text>
        : <Text key={i} style={styles.fieldValue}>{r.value}</Text>)}
    </View>
  );
};

const renderSection = (record, sid, idx) => {
  const fields = SECTION_FIELDS[sid] || [];
  const present = fields.filter(f => fieldPresent(record, f));
  if (present.length === 0) return null;
  const title = SECTION_TITLES[sid];
  return present.map((f, i) => renderField(record, f, i === 0 ? title : null, idx));
};

/* ═══════ COMPONENT ═══════ */
const EndocrineLabResultsDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.endocrine_lab_results) return Array.isArray(r.endocrine_lab_results) ? r.endocrine_lab_results : [r.endocrine_lab_results];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.endocrine_lab_results) return Array.isArray(dd.endocrine_lab_results) ? dd.endocrine_lab_results : [dd.endocrine_lab_results]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  const DOC_TITLE = 'Endocrine Lab Results';

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}><Text style={styles.documentTitle}>{DOC_TITLE}</Text></View>
          <Text style={styles.noDataText}>No endocrine lab results records available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>{DOC_TITLE}</Text></View>
        {/* Flatten record children directly under <Page> — a per-record wrapper <View> is a
            keep-together unit react-pdf shoves WHOLE to the next page (page 1 = title only). break
            rides the record-title Text (a direct Page child). (memory 6a4deac1 / Rule #74) */}
        {records.flatMap((record, idx) => {
          const els = [<Text key={`rt-${idx}`} style={styles.recordTitle} break={idx > 0}>{`Endocrine Lab Results ${idx + 1}`}</Text>];
          Object.keys(SECTION_FIELDS).forEach(sid => { const sec = renderSection(record, sid, idx); if (sec) els.push(...sec); });
          return els;
        })}
      </Page>
    </Document>
  );
};

export default EndocrineLabResultsDocumentPDFTemplate;
