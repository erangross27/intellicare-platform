import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * IvInfusionsDocumentPDFTemplate - box-free canonical (LETTER)
 * Mirrors IvInfusionsDocument.jsx SECTION_TITLES / FIELD_LABELS / SECTION_FIELDS and the
 * field-type routing (boolean / numeric / array / sentence / simple) + HIDE_ZERO rule.
 * No boxes: underline rules only (documentTitle 2 / recordTitle+sectionTitle 1 / fieldLabel 0.5).
 * NO date field in this schema — record header shows ONLY the numbered record title.
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
const SECTION_ORDER = ['infusion-details', 'iv-access', 'safety-reactions', 'monitoring-labs', 'nursing-education'];

const SECTION_TITLES = {
  'infusion-details': 'Infusion Details',
  'iv-access': 'IV Access',
  'safety-reactions': 'Safety & Reactions',
  'monitoring-labs': 'Monitoring & Labs',
  'nursing-education': 'Nursing & Education',
};

const FIELD_LABELS = {
  infusionMedication: 'Infusion Medication',
  dosageAmount: 'Dosage Amount',
  infusionRate: 'Infusion Rate',
  totalVolumeInfused: 'Total Volume Infused (mL)',
  infusionDuration: 'Infusion Duration (min)',
  infusionPump: 'Infusion Pump',
  infusionProtocol: 'Infusion Protocol',
  ivAccessSite: 'IV Access Site',
  catheterType: 'Catheter Type',
  catheterGauge: 'Catheter Gauge',
  centralLineBundle: 'Central Line Bundle Compliance',
  vesicantMedication: 'Vesicant Medication',
  compatibilityCheck: 'Compatibility Check',
  premedications: 'Premedications',
  infusionReactions: 'Infusion Reactions',
  extravasationOccurrence: 'Extravasation Occurrence',
  phlebitisScore: 'Phlebitis Score',
  baselineVitalSigns: 'Baseline Vital Signs',
  postInfusionVitalSigns: 'Post-Infusion Vital Signs',
  fluidBalance: 'Fluid Balance (mL)',
  electrolyteLevels: 'Electrolyte Levels',
  renalFunction: 'Renal Function',
  hepaticFunction: 'Hepatic Function',
  nursingAssessment: 'Nursing Assessment',
  patientEducation: 'Patient Education',
};

const SECTION_FIELDS = {
  'infusion-details': ['infusionMedication', 'dosageAmount', 'infusionRate', 'totalVolumeInfused', 'infusionDuration', 'infusionPump', 'infusionProtocol'],
  'iv-access': ['ivAccessSite', 'catheterType', 'catheterGauge', 'centralLineBundle'],
  'safety-reactions': ['vesicantMedication', 'compatibilityCheck', 'premedications', 'infusionReactions', 'extravasationOccurrence', 'phlebitisScore'],
  'monitoring-labs': ['baselineVitalSigns', 'postInfusionVitalSigns', 'fluidBalance', 'electrolyteLevels', 'renalFunction', 'hepaticFunction'],
  'nursing-education': ['nursingAssessment', 'patientEducation'],
};

const SENTENCE_FIELDS = ['baselineVitalSigns', 'postInfusionVitalSigns', 'electrolyteLevels', 'renalFunction', 'hepaticFunction', 'infusionProtocol', 'nursingAssessment', 'patientEducation'];
const NUMERIC_FIELDS = ['dosageAmount', 'infusionRate', 'totalVolumeInfused', 'infusionDuration', 'phlebitisScore', 'fluidBalance'];
const BOOLEAN_FIELDS = ['vesicantMedication', 'extravasationOccurrence', 'compatibilityCheck', 'centralLineBundle'];
const ARRAY_FIELDS = ['premedications', 'infusionReactions'];
/* HIDE_ZERO_FIELDS mirrors the JSX: ONLY dose / rate / volume / duration — 0 = not recorded.
   phlebitisScore and fluidBalance ALWAYS display even when 0 (grade-0 phlebitis / 0 mL balance
   are real clinical values). Real decimals (e.g. dosageAmount 0.5) still display. */
const HIDE_ZERO_FIELDS = ['dosageAmount', 'infusionRate', 'totalVolumeInfused', 'infusionDuration'];

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

const hasVal = (v) => {
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'boolean') return true;
  if (typeof v === 'number') return true;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v).length > 0;
  return true;
};

const fmtVal = (v) => {
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return String(v);
  const s = String(v || '');
  return s.replace(/(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(:\d{2})?/g, '$1 $2');
};

/* arrItemText: same array-item stringification as the JSX (4-AREA RULE) */
const arrItemText = (item) => {
  if (item === null || item === undefined) return '';
  if (typeof item === 'object') return Object.values(item).filter(x => x !== null && x !== undefined && x !== '').map(String).join(' — ');
  return String(item);
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|[A-Z]))[.;](?:\s+)/).map(s => s.trim().replace(/^\d+\.\s+/, '')).filter(s => s && !/^[;.,!?]+$/.test(s));
};

const splitBySemicolon = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/;\s*/).map(s => s.trim()).filter(Boolean);
};

const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#:'"-]{1,80}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) {
      const rest = text.slice(i + 1).trimStart();
      if (/^\d{4}\b/.test(rest)) { current += ch; }
      else { const t = current.trim(); if (t) result.push(t); current = ''; }
    }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

const strip = (s) => safeString(s).replace(/^\s*\d+\.\s+/, '').replace(/[;.]+$/, '').trim();

/* sentenceRows: mirrors the JSX renderSentenceField decomposition —
   period-first split (semicolon fallback), parseLabel subtitles, then comma/semicolon
   items; a single non-labeled sentence that is a comma list is itself decomposed. */
const sentenceRows = (text) => {
  const rows = [];
  const strVal = fmtVal(text);
  const periodItems = splitBySentence(strVal);
  const isSemicolon = periodItems.length < 2;
  const sentences = isSemicolon ? splitBySemicolon(strVal) : periodItems;

  if (sentences.length > 1) {
    sentences.forEach(s => {
      const p = parseLabel(s);
      if (p.isLabeled) {
        const semiItems = splitBySemicolon(p.value);
        const items = semiItems.length >= 2 ? semiItems : splitByComma(p.value);
        const hasOxford = items.some(ci => ci.trim().toLowerCase().startsWith('and '));
        if (items.length >= 2 && !hasOxford) {
          rows.push({ type: 'sub', text: p.label });
          items.forEach(it => rows.push({ type: 'item', text: it }));
        } else {
          rows.push({ type: 'item', text: s });
        }
      } else {
        rows.push({ type: 'item', text: s });
      }
    });
    return rows;
  }

  /* Single sentence: split comma items into separate rows (labeled or not) */
  const commaItems = splitByComma(strVal);
  const hasOxford = commaItems.some(ci => ci.trim().toLowerCase().startsWith('and '));
  if (commaItems.length >= 2 && !hasOxford) {
    commaItems.forEach(ci => {
      const cp = parseLabel(ci);
      if (cp.isLabeled) { rows.push({ type: 'sub', text: cp.label }); rows.push({ type: 'item', text: cp.value }); }
      else rows.push({ type: 'item', text: ci });
    });
    return rows;
  }
  rows.push({ type: 'item', text: strVal });
  return rows;
};

const fieldHasVal = (record, f) => {
  const v = record[f];
  if (HIDE_ZERO_FIELDS.includes(f) && v === 0) return false;
  if (ARRAY_FIELDS.includes(f)) return Array.isArray(v) && v.some(item => arrItemText(item));
  return hasVal(v);
};

const fieldBody = (record, f) => {
  const v = record[f];
  if (BOOLEAN_FIELDS.includes(f)) return [<Text key="v" style={styles.value}>{v ? 'Yes' : 'No'}</Text>];
  if (NUMERIC_FIELDS.includes(f)) return [<Text key="v" style={styles.value}>{safeString(String(v))}</Text>];
  if (ARRAY_FIELDS.includes(f)) {
    const items = (Array.isArray(v) ? v : []).map(arrItemText).filter(Boolean);
    return items.map((it, i) => <Text key={i} style={styles.value}>{i + 1}. {safeString(it)}</Text>);
  }
  if (SENTENCE_FIELDS.includes(f)) {
    const rows = sentenceRows(v);
    if (rows.length === 0) return [<Text key="v" style={styles.value}>{safeString(fmtVal(v))}</Text>];
    return rows.map((r, i) => r.type === 'sub'
      ? <Text key={i} style={styles.subLabel}>{safeString(r.text)}</Text>
      : <Text key={i} style={styles.value}>{strip(r.text)}</Text>);
  }
  /* simple string field — render whole (mirrors JSX renderSimpleField) */
  return [<Text key="v" style={styles.value}>{safeString(fmtVal(v))}</Text>];
};

const renderSection = (record, sid) => {
  const fields = SECTION_FIELDS[sid] || [];
  const present = fields.filter(f => fieldHasVal(record, f));
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

const IvInfusionsDocumentPDFTemplate = ({ document: docProp, data = docProp }) => {
  let records = [];
  if (Array.isArray(data)) records = data;
  else if (data && typeof data === 'object') records = [data];
  records = records.flatMap(r => {
    if (r?.iv_infusions) return Array.isArray(r.iv_infusions) ? r.iv_infusions : [r.iv_infusions];
    if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.iv_infusions) return Array.isArray(dd.iv_infusions) ? dd.iv_infusions : [dd.iv_infusions]; return [dd]; }
    return [r];
  }).filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>IV Infusions</Text>
          <Text style={styles.noData}>No IV infusions records available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>IV Infusions</Text>
        {records.map((record, rIdx) => {
          const recordNum = (record._originalIdx ?? rIdx) + 1;
          return (
            <View key={rIdx}>
              {/* NO date field in this schema — ONLY the numbered record title */}
              <Text style={styles.recordTitle} break={rIdx > 0}>{safeString(`IV Infusions ${recordNum}`)}</Text>
              {SECTION_ORDER.map(sid => renderSection(record, sid))}
            </View>
          );
        })}
        <Text style={styles.footer} fixed>This document contains Protected Health Information (PHI). Handle in accordance with HIPAA.</Text>
      </Page>
    </Document>
  );
};

export default IvInfusionsDocumentPDFTemplate;
