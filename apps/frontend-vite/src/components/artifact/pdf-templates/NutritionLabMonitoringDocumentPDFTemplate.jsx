import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * NutritionLabMonitoringDocumentPDFTemplate - box-free canonical (LETTER)
 * Config-driven from the JSX SECTION_ORDER/SECTION_TITLES/FIELD_LABELS/SECTION_FIELDS.
 * Renders EVERY populated field the JSX renders (hide-zero numbers hidden, same as JSX) for
 * JSX/PDF field parity. No boxes: underline rules only (documentTitle 2 / recordTitle+sectionTitle 1 /
 * fieldLabel 0.5). No top-level `date` field → TITLE-ONLY record header (no date badge).
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
  footer: { position: 'absolute', bottom: 24, left: 40, right: 40, fontSize: 9, color: '#666666', textAlign: 'center', borderTopWidth: 0.5, borderTopColor: '#cccccc', paddingTop: 6 },
  noData: { fontSize: 14, textAlign: 'center', marginTop: 40, color: '#666666' },
});

/* CONFIG (mirrors the JSX) */
const SECTION_ORDER = ['visceral-proteins', 'immune-inflammation', 'trace-elements', 'vitamins', 'iron-studies', 'metabolic-indices'];

const SECTION_TITLES = {
  'visceral-proteins': 'Visceral Proteins',
  'immune-inflammation': 'Immune & Inflammation',
  'trace-elements': 'Trace Elements',
  'vitamins': 'Vitamins',
  'iron-studies': 'Iron Studies',
  'metabolic-indices': 'Metabolic & Indices',
};

const FIELD_LABELS = {
  prealbumin: 'Prealbumin',
  serumAlbumin: 'Serum Albumin',
  transferrinLevel: 'Transferrin Level',
  retinolBindingProtein: 'Retinol Binding Protein',
  totalLymphocyteCount: 'Total Lymphocyte Count',
  cReactiveProtein: 'C-Reactive Protein',
  serumZinc: 'Serum Zinc',
  serumCopper: 'Serum Copper',
  serumSelenium: 'Serum Selenium',
  vitaminD25Hydroxy: 'Vitamin D 25-Hydroxy',
  vitaminB12Level: 'Vitamin B12 Level',
  redBloodCellFolate: 'Red Blood Cell Folate',
  methylmalonicAcid: 'Methylmalonic Acid',
  homocysteineLevel: 'Homocysteine Level',
  serumIron: 'Serum Iron',
  totalIronBindingCapacity: 'Total Iron Binding Capacity',
  ferritinLevel: 'Ferritin Level',
  nitrogenBalance: 'Nitrogen Balance',
  indirectCalorimetryREE: 'Indirect Calorimetry REE',
  respiratoryQuotient: 'Respiratory Quotient',
  prognosticNutritionalIndex: 'Prognostic Nutritional Index',
  nutritionRiskScreeningScore: 'Nutrition Risk Screening Score',
  subjectiveGlobalAssessment: 'Subjective Global Assessment',
  refeedingSyndromeRisk: 'Refeeding Syndrome Risk',
  micronutrientDeficiencies: 'Micronutrient Deficiencies',
};

const SECTION_FIELDS = {
  'visceral-proteins': ['prealbumin', 'serumAlbumin', 'transferrinLevel', 'retinolBindingProtein'],
  'immune-inflammation': ['totalLymphocyteCount', 'cReactiveProtein'],
  'trace-elements': ['serumZinc', 'serumCopper', 'serumSelenium'],
  'vitamins': ['vitaminD25Hydroxy', 'vitaminB12Level', 'redBloodCellFolate', 'methylmalonicAcid', 'homocysteineLevel'],
  'iron-studies': ['serumIron', 'totalIronBindingCapacity', 'ferritinLevel'],
  'metabolic-indices': ['nitrogenBalance', 'indirectCalorimetryREE', 'respiratoryQuotient', 'prognosticNutritionalIndex', 'nutritionRiskScreeningScore', 'subjectiveGlobalAssessment', 'refeedingSyndromeRisk', 'micronutrientDeficiencies'],
};

const NUMBER_FIELDS = ['prealbumin', 'serumAlbumin', 'transferrinLevel', 'totalLymphocyteCount', 'retinolBindingProtein', 'serumZinc', 'serumCopper', 'serumSelenium', 'vitaminD25Hydroxy', 'vitaminB12Level', 'redBloodCellFolate', 'serumIron', 'totalIronBindingCapacity', 'ferritinLevel', 'methylmalonicAcid', 'homocysteineLevel', 'cReactiveProtein', 'nitrogenBalance', 'indirectCalorimetryREE', 'respiratoryQuotient', 'prognosticNutritionalIndex', 'nutritionRiskScreeningScore'];
const ARRAY_FIELDS = ['micronutrientDeficiencies'];
const DATE_FIELDS = [];

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

/* numeric presence check — 0 and absent are hidden, never truthiness */
const hasNumber = (v) => {
  if (v === null || v === undefined || v === '') return false;
  const n = Number(v);
  return Number.isFinite(n) && n !== 0;
};

const hasArray = (v) => Array.isArray(v) && v.filter(x => x !== null && x !== undefined && String(x).trim() !== '').length > 0;

const hasString = (v) => {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') return v.trim() !== '';
  if (typeof v === 'number') return v !== 0;
  return String(v).trim() !== '';
};

const fieldHasVal = (fn, v) => {
  if (NUMBER_FIELDS.includes(fn)) return hasNumber(v);
  if (ARRAY_FIELDS.includes(fn)) return hasArray(v);
  return hasString(v);
};

// A hide-zero number field stays visible at 0 when a doctor explicitly set it (doctorEdits.editedFields)
const fieldVisible = (record, fn) => fieldHasVal(fn, record[fn]) || (NUMBER_FIELDS.includes(fn) && Array.isArray(record?.doctorEdits?.editedFields) && record.doctorEdits.editedFields.includes(fn));

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};

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

const fieldBody = (record, f) => {
  const v = record[f];
  if (DATE_FIELDS.includes(f)) return [<Text key="v" style={styles.value}>{safeString(formatDate(v))}</Text>];
  if (NUMBER_FIELDS.includes(f)) return [<Text key="v" style={styles.value}>{safeString(String(v))}</Text>];
  if (ARRAY_FIELDS.includes(f)) {
    const items = (Array.isArray(v) ? v : [v]).filter(x => x !== null && x !== undefined && String(x).trim() !== '');
    return items.map((item, i) => {
      const p = parseLabel(String(item));
      return <Text key={i} style={styles.value}>{i + 1}. {strip(p.value || String(item))}</Text>;
    });
  }
  const rows = sentenceRows(String(v));
  if (rows.length === 0) return [<Text key="v" style={styles.value}>{safeString(String(v))}</Text>];
  return rows.map((r, i) => r.type === 'sub'
    ? <Text key={i} style={styles.subLabel}>{safeString(r.text)}</Text>
    : <Text key={i} style={styles.value}>{strip(r.text)}</Text>);
};

const renderSection = (record, sid) => {
  const fields = SECTION_FIELDS[sid] || [];
  const present = fields.filter(f => fieldVisible(record, f));
  if (present.length === 0) return null;
  const sectionTitle = SECTION_TITLES[sid];
  return present.map((f, i) => {
    const label = FIELD_LABELS[f] || f;
    const showLabel = label.trim().toLowerCase() !== (sectionTitle || '').trim().toLowerCase();
    return (
      <View key={f} style={styles.fieldWrap} wrap={false}>
        {i === 0 && <Text style={styles.sectionTitle}>{safeString(sectionTitle)}</Text>}
        {showLabel && <Text style={styles.fieldLabel}>{safeString(label)}</Text>}
        {fieldBody(record, f)}
      </View>
    );
  });
};

const NutritionLabMonitoringDocumentPDFTemplate = ({ document: docProp, data = docProp }) => {
  const pick = (r) => r && r.nutrition_lab_monitoring;
  let records = [];
  if (Array.isArray(data)) {
    const p0 = data.length > 0 ? pick(data[0]) : null;
    records = p0 && Array.isArray(p0) ? p0 : data;
  } else if (data && pick(data)) {
    const p = pick(data);
    records = Array.isArray(p) ? p : [p];
  } else if (data && typeof data === 'object') {
    records = [data];
  }
  records = records.filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Nutrition Lab Monitoring</Text>
          <Text style={styles.noData}>No nutrition lab monitoring records available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Nutrition Lab Monitoring</Text>
        {records.map((record, rIdx) => (
          <View key={rIdx}>
            <Text style={styles.recordTitle} break={rIdx > 0}>{safeString(`Nutrition Lab Monitoring ${rIdx + 1}`)}</Text>
            {SECTION_ORDER.map(sid => renderSection(record, sid))}
          </View>
        ))}
        <Text style={styles.footer} fixed>This document contains Protected Health Information (PHI). Handle in accordance with HIPAA.</Text>
      </Page>
    </Document>
  );
};

export default NutritionLabMonitoringDocumentPDFTemplate;
