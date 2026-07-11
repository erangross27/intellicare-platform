import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * IntraoperativeCholangiographyDocumentPDFTemplate - box-free canonical (LETTER)
 * Config-driven from the JSX SECTION_ORDER/SECTION_TITLES/FIELD_LABELS/SECTION_FIELDS.
 * Renders EVERY populated field the JSX renders for JSX/PDF field parity.
 * No boxes: underline rules only (documentTitle 2 / recordTitle+sectionTitle 1 / fieldLabel 0.5).
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
const SECTION_ORDER = ['procedure-info', 'contrast-details', 'bile-duct-visualization', 'findings', 'variants-complications', 'assessment', 'recommendations-section'];

const SECTION_TITLES = {
  'procedure-info': 'Procedure Information',
  'contrast-details': 'Contrast Details',
  'bile-duct-visualization': 'Bile Duct Visualization',
  'findings': 'Findings',
  'variants-complications': 'Variants & Complications',
  'assessment': 'Assessment',
  'recommendations-section': 'Recommendations',
};

const FIELD_LABELS = {
  performanceDate: 'Performance Date',
  indication: 'Indication',
  technique: 'Technique',
  contrastType: 'Contrast Type',
  contrastVolume: 'Contrast Volume',
  bileDuctVisualized: 'Bile Duct Visualized',
  commonBileDuct: 'Common Bile Duct',
  hepaticDucts: 'Hepatic Ducts',
  cysticDuct: 'Cystic Duct',
  duodenalFilling: 'Duodenal Filling',
  choledocholithiasis: 'Choledocholithiasis',
  ductalDilation: 'Ductal Dilation',
  filllingDefects: 'Filling Defects',
  anatomicalVariants: 'Anatomical Variants',
  complications: 'Complications',
  interpretation: 'Interpretation',
  recommendedActions: 'Recommended Actions',
  imageQuality: 'Image Quality',
  recommendations: 'Recommendations',
};

const SECTION_FIELDS = {
  'procedure-info': ['performanceDate', 'indication', 'technique'],
  'contrast-details': ['contrastType', 'contrastVolume'],
  'bile-duct-visualization': ['bileDuctVisualized', 'commonBileDuct', 'hepaticDucts', 'cysticDuct'],
  'findings': ['duodenalFilling', 'choledocholithiasis', 'ductalDilation', 'filllingDefects'],
  'variants-complications': ['anatomicalVariants', 'complications'],
  'assessment': ['interpretation', 'recommendedActions', 'imageQuality'],
  'recommendations-section': ['recommendations'],
};

const DATE_FIELDS = ['performanceDate'];
const ARRAY_FIELDS = ['complications'];
const OBJECT_ARRAY_FIELDS = ['recommendations'];
const ENUM_FIELDS = ['bileDuctVisualized', 'duodenalFilling', 'choledocholithiasis'];
const ENUM_OPTIONS = {
  bileDuctVisualized: ['Yes', 'No'],
  duodenalFilling: ['Yes', 'No'],
  choledocholithiasis: ['Yes', 'No'],
};
const enumCanonical = (options, val) => { const cur = String(val ?? '').trim(); const hit = (options || []).find(o => o.toLowerCase() === cur.toLowerCase()); return hit || cur; };

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

const isEmptyDeep = (v) => {
  if (v === null || v === undefined) return true;
  if (typeof v === 'boolean') return false;
  if (typeof v === 'number') return !Number.isFinite(v);
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0;
  if (typeof v === 'object') return Object.values(v).every(isEmptyDeep);
  return false;
};

const hasVal = (v) => {
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'boolean') return true;
  if (typeof v === 'number') return true;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length > 0;
  if (typeof v === 'object') return !isEmptyDeep(v);
  return true;
};

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
  if (ENUM_FIELDS.includes(f)) return [<Text key="v" style={styles.value}>{safeString(enumCanonical(ENUM_OPTIONS[f] || [], String(v)))}</Text>];
  if (ARRAY_FIELDS.includes(f)) {
    const arr = (Array.isArray(v) ? v : [v]).filter(x => hasVal(x));
    return arr.map((item, i) => <Text key={i} style={styles.value}>{safeString(`${i + 1}. ${String(item)}`)}</Text>);
  }
  if (OBJECT_ARRAY_FIELDS.includes(f)) {
    const recs = Array.isArray(v) ? v : [];
    const rows = []; let lastDate = null; let n = 1;
    recs.forEach((rec) => {
      const rt = (typeof rec === 'string' ? rec : (rec?.recommendation || '')).trim();
      if (!rt) return;
      const rd = (typeof rec === 'object' && rec?.date ? rec.date : '').trim();
      if (rd !== lastDate) { if (rd) rows.push({ type: 'sub', text: rd }); lastDate = rd; n = 1; }
      rows.push({ type: 'item', text: `${n++}. ${rt}` });
    });
    return rows.map((r, i) => r.type === 'sub'
      ? <Text key={i} style={styles.subLabel}>{safeString(r.text)}</Text>
      : <Text key={i} style={styles.value}>{safeString(r.text)}</Text>);
  }
  const rows = sentenceRows(String(v));
  if (rows.length === 0) return [<Text key="v" style={styles.value}>{safeString(String(v))}</Text>];
  return rows.map((r, i) => r.type === 'sub'
    ? <Text key={i} style={styles.subLabel}>{safeString(r.text)}</Text>
    : <Text key={i} style={styles.value}>{strip(r.text)}</Text>);
};

const renderSection = (record, sid) => {
  const fields = SECTION_FIELDS[sid] || [];
  const present = fields.filter(f => hasVal(record[f]));
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

const IntraoperativeCholangiographyDocumentPDFTemplate = ({ document: docProp, data = docProp }) => {
  let records = [];
  if (Array.isArray(data)) records = data;
  else if (data && data.intraoperative_cholangiography && Array.isArray(data.intraoperative_cholangiography)) records = data.intraoperative_cholangiography;
  else if (data && data.documentData) {
    const dd = data.documentData;
    if (Array.isArray(dd)) records = dd;
    else if (dd && dd.intraoperative_cholangiography && Array.isArray(dd.intraoperative_cholangiography)) records = dd.intraoperative_cholangiography;
    else if (dd && typeof dd === 'object') records = [dd];
  } else if (data && typeof data === 'object') records = [data];
  records = records.filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Intraoperative Cholangiography</Text>
          <Text style={styles.noData}>No intraoperative cholangiography records available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Intraoperative Cholangiography</Text>
        {records.map((record, rIdx) => (
          <View key={rIdx}>
            <Text style={styles.recordTitle} break={rIdx > 0}>{safeString(`Intraoperative Cholangiography ${rIdx + 1}`)}</Text>
            {SECTION_ORDER.map(sid => renderSection(record, sid))}
          </View>
        ))}
        <Text style={styles.footer} fixed>This document contains Protected Health Information (PHI). Handle in accordance with HIPAA.</Text>
      </Page>
    </Document>
  );
};

export default IntraoperativeCholangiographyDocumentPDFTemplate;
