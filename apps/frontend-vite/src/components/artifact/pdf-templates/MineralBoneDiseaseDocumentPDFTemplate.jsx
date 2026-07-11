import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * MineralBoneDiseaseDocumentPDFTemplate - box-free canonical (LETTER)
 * Config-driven from the JSX SECTION_ORDER/SECTION_TITLES/FIELD_LABELS/SECTION_FIELDS.
 * Renders EVERY populated field the JSX renders (numbers incl. 0) for JSX/PDF field parity.
 * No boxes: underline rules only (documentTitle 2 / recordTitle+sectionTitle 1 / fieldLabel 0.5).
 * medications / pthTrend / recommendations = arrays-of-objects -> each object decomposes into a
 * per-item subLabel header plus label-above-value sub-fields (mirrors the JSX; never side-by-side).
 * boneDensity / results = objects -> flattened label-above-value rows.
 * Record date is record.date - NEVER createdAt/updatedAt.
 * safeString uses \uXXXX escapes ONLY (never literal smart-quotes/em-dashes/invisible chars).
 */

const styles = StyleSheet.create({
  page: { padding: 40, paddingBottom: 64, fontFamily: 'Helvetica', fontSize: 14, backgroundColor: '#ffffff', color: '#000000', lineHeight: 1.4 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', marginBottom: 16, paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', marginTop: 14, marginBottom: 10, paddingBottom: 5, borderBottomWidth: 1, borderBottomColor: '#000000' },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginTop: 10, marginBottom: 6, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000' },
  fieldWrap: { marginBottom: 8 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginTop: 6, marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  itemLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginTop: 6, marginBottom: 2 },
  subLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginTop: 4, marginBottom: 2 },
  value: { fontSize: 14, paddingLeft: 8, marginBottom: 3, lineHeight: 1.4 },
  footer: { position: 'absolute', bottom: 24, left: 40, right: 40, fontSize: 9, color: '#666666', textAlign: 'center', borderTopWidth: 0.5, borderTopColor: '#cccccc', paddingTop: 6 },
  noData: { fontSize: 14, textAlign: 'center', marginTop: 40, color: '#666666' },
});

/* CONFIG (mirrors the JSX) */
const SECTION_ORDER = ['record-info', 'lab-values', 'pth-trend', 'medications', 'bone-density', 'vascular-calcification', 'findings', 'assessment', 'plan', 'recommendations', 'results', 'notes'];

const SECTION_TITLES = {
  'record-info': 'Record Information',
  'lab-values': 'Lab Values',
  'pth-trend': 'PTH Trend',
  'medications': 'Medications',
  'bone-density': 'Bone Density',
  'vascular-calcification': 'Vascular Calcification',
  'findings': 'Findings',
  'assessment': 'Assessment',
  'plan': 'Plan',
  'recommendations': 'Recommendations',
  'results': 'Results',
  'notes': 'Notes',
};

const FIELD_LABELS = {
  date: 'Date',
  type: 'Type',
  provider: 'Provider',
  facility: 'Facility',
  pth: 'PTH',
  calcium: 'Calcium',
  phosphorus: 'Phosphorus',
  vitaminD25: 'Vitamin D (25-OH)',
  vitaminD125: 'Vitamin D (1,25-OH)',
  alkalinePhosphatase: 'Alkaline Phosphatase',
  pthTrend: 'PTH Trend',
  medications: 'Medications',
  boneDensity: 'Bone Density',
  vascularCalcification: 'Vascular Calcification',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  recommendations: 'Recommendations',
  results: 'Results',
  notes: 'Notes',
};

const SECTION_FIELDS = {
  'record-info': ['date', 'type', 'provider', 'facility'],
  'lab-values': ['pth', 'calcium', 'phosphorus', 'vitaminD25', 'vitaminD125', 'alkalinePhosphatase'],
  'pth-trend': ['pthTrend'],
  'medications': ['medications'],
  'bone-density': ['boneDensity'],
  'vascular-calcification': ['vascularCalcification'],
  'findings': ['findings'],
  'assessment': ['assessment'],
  'plan': ['plan'],
  'recommendations': ['recommendations'],
  'results': ['results'],
  'notes': ['notes'],
};

const NUMBER_FIELDS = [];
const DATE_FIELDS = ['date'];
const BOOLEAN_FIELDS = ['vascularCalcification'];
const OBJECT_FIELDS = ['boneDensity', 'results'];
const OBJECT_ARRAY_FIELDS = ['pthTrend', 'medications', 'recommendations'];

const OBJECT_ARRAY_SUBFIELDS = {
  medications: [
    { key: 'name', label: 'Name' },
    { key: 'dose', label: 'Dose' },
    { key: 'indication', label: 'Indication' },
  ],
  pthTrend: [
    { key: 'date', label: 'Date' },
    { key: 'value', label: 'Value' },
    { key: 'status', label: 'Status' },
  ],
  recommendations: [
    { key: 'recommendation', label: 'Recommendation' },
    { key: 'date', label: 'Date' },
  ],
};

/* HELPERS (mirror the JSX) - safeString uses \uXXXX escapes ONLY (never literal smart-quotes/invisible chars) */
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

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); if (isNaN(d.getTime())) return String(dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};

const humanizeKey = (k) => k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();

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
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|[A-Z])|\d)[.;](?:\s+)/).map(s => s.trim().replace(/^\d+\.\s+/, '')).filter(s => s && !/^[;.,!?]+$/.test(s));
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

/* flattenObject: boneDensity / results dynamic-key objects -> label-above-value rows */
const flattenObject = (obj) => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return [];
  const items = [];
  Object.entries(obj).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return;
    const label = humanizeKey(key);
    if (typeof value === 'boolean') items.push({ label, value: value ? 'Yes' : 'No' });
    else if (Array.isArray(value)) items.push({ label, value: value.join(', ') });
    else if (typeof value === 'object') {
      Object.entries(value).forEach(([subKey, subValue]) => {
        if (subValue !== null && subValue !== undefined && subValue !== '') items.push({ label: `${label} - ${humanizeKey(subKey)}`, value: String(subValue) });
      });
    } else items.push({ label, value: String(value) });
  });
  return items;
};

/* objectArrayRows: medications / pthTrend / recommendations arrays-of-objects -> each item is a
   subLabel header ("Medication 1") + its populated sub-fields as label-above-value (unknown keys shown too). */
const objectArrayRows = (f, val, singular) => {
  const items = (Array.isArray(val) ? val : []).filter(it => it !== null && it !== undefined && it !== '');
  const subDefs = OBJECT_ARRAY_SUBFIELDS[f] || [];
  const out = [];
  items.forEach((item, i) => {
    if (typeof item !== 'object') {
      out.push(<View key={i}><Text style={styles.value}>{strip(String(item))}</Text></View>);
      return;
    }
    const knownKeys = subDefs.map(sf => sf.key);
    const extraDefs = Object.keys(item).filter(k => !knownKeys.includes(k)).map(k => ({ key: k, label: humanizeKey(k) }));
    const defs = [...subDefs, ...extraDefs].filter(sf => hasVal(item[sf.key]));
    if (defs.length === 0) return;
    out.push(
      <View key={i} wrap={false}>
        <Text style={styles.itemLabel}>{safeString(`${singular} ${i + 1}`)}</Text>
        {defs.map(sf => (
          <View key={sf.key}>
            <Text style={styles.subLabel}>{safeString(sf.label)}</Text>
            <Text style={styles.value}>{sf.key === 'date' ? safeString(formatDate(item[sf.key])) : safeString(String(item[sf.key]))}</Text>
          </View>
        ))}
      </View>
    );
  });
  return out;
};

const objectRows = (val) => {
  const items = flattenObject(val);
  return items.map((it, i) => (
    <View key={i}>
      <Text style={styles.subLabel}>{safeString(it.label)}</Text>
      <Text style={styles.value}>{safeString(it.value)}</Text>
    </View>
  ));
};

const fieldPresent = (record, f) => {
  const v = record[f];
  if (OBJECT_ARRAY_FIELDS.includes(f)) return Array.isArray(v) && v.filter(it => it !== null && it !== undefined && it !== '').length > 0;
  if (OBJECT_FIELDS.includes(f)) return flattenObject(v).length > 0;
  if (BOOLEAN_FIELDS.includes(f)) return v !== null && v !== undefined;
  return hasVal(v);
};

const fieldBody = (record, f) => {
  const v = record[f];
  if (OBJECT_ARRAY_FIELDS.includes(f)) return objectArrayRows(f, v, (FIELD_LABELS[f] || f).replace(/s$/, ''));
  if (OBJECT_FIELDS.includes(f)) return objectRows(v);
  if (BOOLEAN_FIELDS.includes(f)) return [<Text key="v" style={styles.value}>{v ? 'Yes' : 'No'}</Text>];
  if (DATE_FIELDS.includes(f)) return [<Text key="v" style={styles.value}>{safeString(formatDate(v))}</Text>];
  if (NUMBER_FIELDS.includes(f)) return [<Text key="v" style={styles.value}>{safeString(String(v))}</Text>];
  const rows = sentenceRows(String(v));
  if (rows.length === 0) return [<Text key="v" style={styles.value}>{safeString(String(v))}</Text>];
  return rows.map((r, i) => r.type === 'sub'
    ? <Text key={i} style={styles.subLabel}>{safeString(r.text)}</Text>
    : <Text key={i} style={styles.value}>{strip(r.text)}</Text>);
};

const renderSection = (record, sid) => {
  const fields = SECTION_FIELDS[sid] || [];
  const present = fields.filter(f => fieldPresent(record, f));
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

const MineralBoneDiseaseDocumentPDFTemplate = ({ document: docProp, data = docProp }) => {
  let records = [];
  let arr = Array.isArray(data) ? data : (data ? [data] : []);
  arr.forEach(r => {
    if (r?.mineral_bone_disease) { const mb = r.mineral_bone_disease; (Array.isArray(mb) ? mb : [mb]).forEach(x => records.push(x)); }
    else if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) dd.forEach(x => records.push(x)); else if (dd?.mineral_bone_disease) (Array.isArray(dd.mineral_bone_disease) ? dd.mineral_bone_disease : [dd.mineral_bone_disease]).forEach(x => records.push(x)); else records.push(dd); }
    else records.push(r);
  });
  records = records.filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Mineral Bone Disease</Text>
          <Text style={styles.noData}>No mineral bone disease records available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Mineral Bone Disease</Text>
        {records.map((record, rIdx) => (
          <View key={rIdx}>
            <Text style={styles.recordTitle} break={rIdx > 0}>{safeString(`Mineral Bone Disease ${rIdx + 1}`)}</Text>
            {SECTION_ORDER.map(sid => renderSection(record, sid))}
          </View>
        ))}
        <Text style={styles.footer} fixed>This document contains Protected Health Information (PHI). Handle in accordance with HIPAA.</Text>
      </Page>
    </Document>
  );
};

export default MineralBoneDiseaseDocumentPDFTemplate;
