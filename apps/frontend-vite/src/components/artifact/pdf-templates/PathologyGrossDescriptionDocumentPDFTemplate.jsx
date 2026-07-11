import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * PathologyGrossDescriptionDocumentPDFTemplate - box-free canonical (LETTER)
 * Config-driven from the JSX SECTION_ORDER/SECTION_TITLES/FIELD_LABELS/SECTION_FIELDS.
 * Renders EVERY populated field the JSX renders for JSX/PDF field parity.
 * No boxes: underline rules only (documentTitle 2 / recordTitle+sectionTitle 1 / fieldLabel 0.5).
 * Record date rides under the record title (the SAME record.date the JSX edits - never createdAt).
 */

const styles = StyleSheet.create({
  page: { padding: 40, paddingBottom: 64, fontFamily: 'Helvetica', fontSize: 14, backgroundColor: '#ffffff', color: '#000000', lineHeight: 1.4 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', marginBottom: 16, paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', marginTop: 14, marginBottom: 6, paddingBottom: 5, borderBottomWidth: 1, borderBottomColor: '#000000' },
  recordDate: { fontSize: 12, color: '#333333', marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginTop: 10, marginBottom: 6, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000' },
  fieldWrap: { marginBottom: 8 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginTop: 6, marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  subLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginTop: 4, marginBottom: 2 },
  value: { fontSize: 14, paddingLeft: 8, marginBottom: 3, lineHeight: 1.4 },
  footer: { position: 'absolute', bottom: 24, left: 40, right: 40, fontSize: 9, color: '#666666', textAlign: 'center', borderTopWidth: 0.5, borderTopColor: '#cccccc', paddingTop: 6 },
  noData: { fontSize: 14, textAlign: 'center', marginTop: 40, color: '#666666' },
});

/* CONFIG (mirrors the JSX) */
const SECTION_ORDER = ['specimen-info', 'gross-exam', 'margins-nodes', 'processing', 'assessment', 'documentation'];

const SECTION_TITLES = {
  'specimen-info': 'Specimen Information',
  'gross-exam': 'Gross Examination',
  'margins-nodes': 'Margins & Nodes',
  'processing': 'Processing Details',
  'assessment': 'Assessment',
  'documentation': 'Documentation',
};

const FIELD_LABELS = {
  procedureName: 'Procedure',
  specimenType: 'Specimen Type',
  specimenSite: 'Site',
  specimenSize: 'Size',
  specimenWeight: 'Weight',
  specimenOrientation: 'Orientation',
  specimenIntegrity: 'Integrity',
  grossAppearance: 'Gross Appearance',
  lesionDescription: 'Lesion Description',
  margins: 'Margins',
  lymphNodes: 'Lymph Nodes',
  fixative: 'Fixative',
  receptacle: 'Receptacle',
  cassettes: 'Cassettes',
  sections: 'Sections',
  additionalFindings: 'Additional Findings',
  notes: 'Notes',
  pathologist: 'Pathologist',
  facility: 'Facility',
};

const SECTION_FIELDS = {
  'specimen-info': ['procedureName', 'specimenType', 'specimenSite', 'specimenSize', 'specimenWeight', 'specimenOrientation', 'specimenIntegrity'],
  'gross-exam': ['grossAppearance', 'lesionDescription'],
  'margins-nodes': ['margins', 'lymphNodes'],
  'processing': ['fixative', 'receptacle', 'cassettes', 'sections'],
  'assessment': ['additionalFindings', 'notes'],
  'documentation': ['pathologist', 'facility'],
};

const ARRAY_FIELDS = ['sections'];

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

/* pushValue: recursively decompose a "Label: value" (nested labels + comma items each possibly
   labeled) into sub-label / item rows - never a side-by-side "Label: value". Mirrors the JSX. */
const pushValue = (text, rows) => {
  const p = parseLabel(text);
  if (p.isLabeled) {
    const items = splitByComma(p.value);
    if (items.length >= 2) {
      rows.push({ type: 'sub', text: p.label });
      items.forEach(it => pushValue(it, rows));
    } else {
      rows.push({ type: 'sub', text: p.label });
      pushValue(p.value, rows);
    }
  } else {
    rows.push({ type: 'item', text });
  }
};

const sentenceRows = (text) => {
  const rows = [];
  splitBySentence(text).forEach(sentence => pushValue(sentence, rows));
  return rows;
};

const fieldBody = (record, f) => {
  const v = record[f];
  if (ARRAY_FIELDS.includes(f)) {
    const items = (Array.isArray(v) ? v : [v]).filter(x => hasVal(x));
    return items.map((it, i) => <Text key={i} style={styles.value}>{safeString(String(it))}</Text>);
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

const PathologyGrossDescriptionDocumentPDFTemplate = ({ document: docProp, data = docProp }) => {
  let records = [];
  if (Array.isArray(data)) records = data;
  else if (data && data.pathology_gross_description && Array.isArray(data.pathology_gross_description)) records = data.pathology_gross_description;
  else if (data && data.documentData) {
    const dd = data.documentData;
    if (Array.isArray(dd)) records = dd;
    else if (dd && dd.pathology_gross_description && Array.isArray(dd.pathology_gross_description)) records = dd.pathology_gross_description;
    else if (dd && typeof dd === 'object') records = [dd];
  } else if (data && typeof data === 'object') records = [data];
  records = records.filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Pathology Gross Description</Text>
          <Text style={styles.noData}>No pathology gross description records available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Pathology Gross Description</Text>
        {records.map((record, rIdx) => (
          <View key={rIdx}>
            <Text style={styles.recordTitle} break={rIdx > 0}>{safeString(`Gross Description ${rIdx + 1}`)}</Text>
            {hasVal(record.date) && <Text style={styles.recordDate}>{safeString(formatDate(record.date))}</Text>}
            {SECTION_ORDER.map(sid => renderSection(record, sid))}
          </View>
        ))}
        <Text style={styles.footer} fixed>This document contains Protected Health Information (PHI). Handle in accordance with HIPAA.</Text>
      </Page>
    </Document>
  );
};

export default PathologyGrossDescriptionDocumentPDFTemplate;
