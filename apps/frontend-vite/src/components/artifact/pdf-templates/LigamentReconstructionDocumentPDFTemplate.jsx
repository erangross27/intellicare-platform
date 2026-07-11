import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * LigamentReconstructionDocumentPDFTemplate - box-free canonical (LETTER)
 * Config-driven from the JSX SECTION_ORDER/SECTION_TITLES/FIELD_LABELS/SECTION_FIELDS.
 * Mirrors the Hematology gold standard: no boxes/cards, underline rules only
 * (documentTitle 2 / recordTitle+sectionTitle 1 / fieldLabel 0.5), each field is ONE
 * wrap={false} atomic View with the sectionTitle riding INSIDE the first present field.
 * Dotted-path leaves (graftSize / tunnelPlacement / fixation) resolved via resolvePath;
 * nested objects (results) flattened recursively via objectRows; object-arrays
 * (recommendations) date-grouped + numbered; narrative strings (findings/notes) use the
 * canonical [.;] sentence split -> parseLabel chain -> thousands-guarded comma split.
 * Renders the SAME record.date the JSX edits (never createdAt/updatedAt). Hide-empty at
 * every level (skip '' / 0-less / [] / {}). safeString uses ONLY \uXXXX escapes.
 * Collection: ligament_reconstruction.
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
const SECTION_ORDER = ['session-info', 'procedure-details', 'graft-size', 'tunnel-placement', 'fixation', 'clinical-narrative', 'results-section', 'recommendations-section'];

const SECTION_TITLES = {
  'session-info': 'Session Information',
  'procedure-details': 'Procedure Details',
  'graft-size': 'Graft Size',
  'tunnel-placement': 'Tunnel Placement',
  'fixation': 'Fixation',
  'clinical-narrative': 'Clinical Narrative',
  'results-section': 'Results',
  'recommendations-section': 'Recommendations',
};

const FIELD_LABELS = {
  date: 'Date',
  provider: 'Provider',
  facility: 'Facility',
  status: 'Status',
  ligament: 'Ligament',
  graftType: 'Graft Type',
  graftSource: 'Graft Source',
  'graftSize.length': 'Length',
  'graftSize.diameter': 'Diameter',
  'tunnelPlacement.femoral': 'Femoral',
  'tunnelPlacement.tibial': 'Tibial',
  'tunnelPlacement.technique': 'Technique',
  'fixation.femoral': 'Femoral',
  'fixation.tibial': 'Tibial',
  'fixation.supplemental': 'Supplemental',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  notes: 'Notes',
  results: 'Results',
  recommendations: 'Recommendations',
};

const SECTION_FIELDS = {
  'session-info': ['date', 'provider', 'facility', 'status'],
  'procedure-details': ['ligament', 'graftType', 'graftSource'],
  'graft-size': ['graftSize.length', 'graftSize.diameter'],
  'tunnel-placement': ['tunnelPlacement.femoral', 'tunnelPlacement.tibial', 'tunnelPlacement.technique'],
  'fixation': ['fixation.femoral', 'fixation.tibial', 'fixation.supplemental'],
  'clinical-narrative': ['findings', 'assessment', 'plan', 'notes'],
  'results-section': ['results'],
  'recommendations-section': ['recommendations'],
};

const DATE_FIELDS = ['date'];
const OBJECT_FIELDS = ['results'];
const OBJECT_ARRAY_FIELDS = ['recommendations'];

/* HELPERS (mirror the JSX) */
const KEY_OVERRIDES = { acl: 'ACL', pcl: 'PCL', mcl: 'MCL', lcl: 'LCL', btb: 'BTB', rom: 'ROM' };
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key];
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'number' ? String(val) : typeof val === 'boolean' ? (val ? 'Yes' : 'No') : String(val);
  return str
    .replace(/[\u2018\u2019\u201B]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u00B0/g, ' deg')
    .replace(/\u00B1/g, '+/-')
    .replace(/\u2265/g, '>=')
    .replace(/\u2264/g, '<=')
    .replace(/\u2192/g, '->')
    .replace(/\u2190/g, '<-')
    .replace(/[\u00D7\u2715\u2716]/g, 'x')
    .replace(/\u00F7/g, '/')
    .replace(/[\u00B5\u03BC]/g, 'u')
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
const hasVal = (v) => !isEmptyDeep(v);
const isScalar = (v) => v === null || typeof v !== 'object';
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
const resolvePath = (obj, path) => { if (!obj || !path) return undefined; return String(path).split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj); };
const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); if (isNaN(d.getTime())) return String(dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
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

/* sentenceRows: splitBySentence -> parseLabel chain -> thousands-guarded splitByComma, fully
   decomposing nested "A: B: value" so a labeled value is never rendered side-by-side (mirrors
   the JSX: label(s) become subLabel rows ABOVE the leaf value). */
const sentenceRows = (text) => {
  const rows = [];
  const emit = (value) => {
    const items = splitByComma(value);
    if (items.length >= 2) {
      items.forEach(it => {
        const ip = parseLabel(it);
        if (ip.isLabeled) { rows.push({ type: 'sub', text: ip.label }); emit(ip.value); }
        else rows.push({ type: 'item', text: it });
      });
    } else {
      const ip = parseLabel(value);
      if (ip.isLabeled) { rows.push({ type: 'sub', text: ip.label }); emit(ip.value); }
      else rows.push({ type: 'item', text: value });
    }
  };
  splitBySentence(text).forEach(sentence => {
    const p = parseLabel(sentence);
    if (p.isLabeled) { rows.push({ type: 'sub', text: p.label }); emit(p.value); }
    else rows.push({ type: 'item', text: sentence });
  });
  return rows;
};

/* Recursively flatten a nested object into box-free rows (scalars inline "Key: value"). */
const objectRows = (obj, kp) => {
  const out = [];
  Object.entries(obj).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v], i) => {
    const key = `${kp}.${k}.${i}`;
    if (isScalar(v)) {
      out.push(<Text key={key} style={styles.value}>{humanizeKey(k)}: {safeString(fmtScalar(v))}</Text>);
    } else if (Array.isArray(v)) {
      out.push(<Text key={key + 'h'} style={styles.subLabel}>{safeString(humanizeKey(k))}</Text>);
      v.filter(x => !isEmptyDeep(x)).forEach((it, j) => {
        if (isScalar(it)) out.push(<Text key={key + '-' + j} style={styles.value}>{j + 1}. {safeString(fmtScalar(it))}</Text>);
        else objectRows(it, key + '-' + j).forEach(r => out.push(r));
      });
    } else {
      out.push(<Text key={key + 'h'} style={styles.subLabel}>{safeString(humanizeKey(k))}</Text>);
      objectRows(v, key).forEach(r => out.push(r));
    }
  });
  return out;
};

/* Object-array (recommendations: {recommendation, date}) -> date-grouped, numbered. */
const recommendationRows = (arr) => {
  const items = (Array.isArray(arr) ? arr : []).filter(x => !isEmptyDeep(x));
  const out = [];
  let lastDate = null; let n = 1;
  items.forEach((r, i) => {
    if (isScalar(r)) { out.push(<Text key={'r' + i} style={styles.value}>{n++}. {safeString(fmtScalar(r))}</Text>); return; }
    const rec = safeString(r.recommendation || '');
    const date = r.date ? formatDate(r.date) : '';
    if (date && date !== lastDate) { out.push(<Text key={'d' + i} style={styles.subLabel}>{safeString(date)}</Text>); lastDate = date; n = 1; }
    if (rec) out.push(<Text key={'ri' + i} style={styles.value}>{n++}. {rec}</Text>);
  });
  return out;
};

const fieldBody = (record, f) => {
  const v = resolvePath(record, f);
  if (DATE_FIELDS.includes(f)) return [<Text key="v" style={styles.value}>{safeString(formatDate(v))}</Text>];
  if (OBJECT_ARRAY_FIELDS.includes(f) || Array.isArray(v)) return recommendationRows(v);
  if (OBJECT_FIELDS.includes(f) || (v && typeof v === 'object')) return objectRows(v, f);
  const rows = sentenceRows(String(v));
  if (rows.length === 0) return [<Text key="v" style={styles.value}>{safeString(String(v))}</Text>];
  return rows.map((r, i) => r.type === 'sub'
    ? <Text key={i} style={styles.subLabel}>{safeString(r.text)}</Text>
    : <Text key={i} style={styles.value}>{strip(r.text)}</Text>);
};

const fieldPresent = (record, f) => hasVal(resolvePath(record, f));

const renderField = (record, f, sectionTitle, isFirst) => {
  const label = FIELD_LABELS[f] || f;
  const showLabel = label.trim().toLowerCase() !== (sectionTitle || '').trim().toLowerCase();
  return (
    <View key={f} style={styles.fieldWrap} wrap={false}>
      {isFirst && <Text style={styles.sectionTitle}>{safeString(sectionTitle)}</Text>}
      {showLabel && <Text style={styles.fieldLabel}>{safeString(label)}</Text>}
      {fieldBody(record, f)}
    </View>
  );
};

const LigamentReconstructionDocumentPDFTemplate = ({ document: docProp, data = docProp }) => {
  let records = [];
  if (Array.isArray(data)) {
    if (data.length === 1 && data[0]?.ligament_reconstruction) records = Array.isArray(data[0].ligament_reconstruction) ? data[0].ligament_reconstruction : [data[0].ligament_reconstruction];
    else records = data;
  } else if (data?.ligament_reconstruction) records = Array.isArray(data.ligament_reconstruction) ? data.ligament_reconstruction : [data.ligament_reconstruction];
  else if (data?.documentData) { const dd = data.documentData; if (Array.isArray(dd)) records = dd; else if (dd?.ligament_reconstruction) records = Array.isArray(dd.ligament_reconstruction) ? dd.ligament_reconstruction : [dd.ligament_reconstruction]; else if (dd && typeof dd === 'object') records = [dd]; }
  else if (data && typeof data === 'object') records = [data];
  records = (records || []).filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Ligament Reconstruction</Text>
          <Text style={styles.noData}>No ligament reconstruction records available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Ligament Reconstruction</Text>
        {records.map((record, rIdx) => (
          <View key={rIdx}>
            <Text style={styles.recordTitle} break={rIdx > 0}>{safeString(`Ligament Reconstruction ${rIdx + 1}`)}</Text>
            {SECTION_ORDER.map(sid => {
              const present = (SECTION_FIELDS[sid] || []).filter(f => fieldPresent(record, f));
              if (present.length === 0) return null;
              const title = SECTION_TITLES[sid];
              return (
                <View key={sid}>
                  {present.map((f, fi) => renderField(record, f, title, fi === 0))}
                </View>
              );
            })}
          </View>
        ))}
        <Text style={styles.footer} fixed>This document contains Protected Health Information (PHI). Handle in accordance with HIPAA.</Text>
      </Page>
    </Document>
  );
};

export default LigamentReconstructionDocumentPDFTemplate;
