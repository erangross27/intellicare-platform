import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * OphthalmologyExamDocumentPDFTemplate - box-free canonical (LETTER)
 * Config-driven from the JSX SECTION_ORDER/SECTION_TITLES/FIELD_LABELS/SECTION_FIELDS.
 * Renders EVERY populated field the JSX renders for JSX/PDF field parity.
 * No boxes: underline rules only (documentTitle 2 / recordTitle+sectionTitle 1 / fieldLabel 0.5).
 * Deeply-nested exam objects (visualAcuity/refraction/pupils/.../fundoscopy/oct) render via a generic
 * recursive renderer; inline "Key: value" is allowed in the PDF only. Record date uses record.date
 * (NEVER createdAt/updatedAt). safeString uses ONLY \uXXXX escapes; Greek mu (U+03BC) / micro sign
 * (U+00B5) are folded to "u" so the Helvetica core font never hits a missing glyph.
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
const SECTION_ORDER = ['exam-info', 'visual-acuity', 'refraction', 'pupils', 'motility-alignment', 'slit-lamp', 'gonioscopy', 'iop', 'fundoscopy', 'oct', 'findings', 'assessment', 'plan', 'results', 'notes'];

const SECTION_TITLES = {
  'exam-info': 'Examination Information',
  'visual-acuity': 'Visual Acuity',
  'refraction': 'Refraction',
  'pupils': 'Pupils',
  'motility-alignment': 'Motility and Alignment',
  'slit-lamp': 'Slit Lamp Examination',
  'gonioscopy': 'Gonioscopy',
  'iop': 'Intraocular Pressure',
  'fundoscopy': 'Fundoscopy',
  'oct': 'Optical Coherence Tomography (OCT)',
  'findings': 'Findings',
  'assessment': 'Assessment',
  'plan': 'Plan',
  'results': 'Results',
  'notes': 'Notes',
};

const FIELD_LABELS = {
  date: 'Date',
  provider: 'Provider',
  technician: 'Technician',
  dilationMedications: 'Dilation Medications',
  status: 'Status',
  facility: 'Facility',
  type: 'Type',
  visualAcuity: 'Visual Acuity',
  refraction: 'Refraction',
  pupils: 'Pupils',
  motilityAlignment: 'Motility and Alignment',
  slitLampExamination: 'Slit Lamp Examination',
  gonioscopy: 'Gonioscopy',
  intraocularPressure: 'Intraocular Pressure',
  fundoscopy: 'Fundoscopy',
  oct: 'Optical Coherence Tomography (OCT)',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  results: 'Results',
  recommendations: 'Recommendations',
  notes: 'Notes',
};

const SECTION_FIELDS = {
  'exam-info': ['date', 'provider', 'technician', 'dilationMedications', 'status', 'facility', 'type'],
  'visual-acuity': ['visualAcuity'],
  'refraction': ['refraction'],
  'pupils': ['pupils'],
  'motility-alignment': ['motilityAlignment'],
  'slit-lamp': ['slitLampExamination'],
  'gonioscopy': ['gonioscopy'],
  'iop': ['intraocularPressure'],
  'fundoscopy': ['fundoscopy'],
  'oct': ['oct'],
  'findings': ['findings'],
  'assessment': ['assessment'],
  'plan': ['plan'],
  'results': ['results'],
  'notes': ['recommendations', 'notes'],
};

const DATE_FIELDS = ['date'];
const NUMBER_FIELDS = [];

/* HELPERS (mirror the JSX) - safeString uses ONLY \uXXXX escapes for special chars.
   micro sign (U+00B5) + Greek small letter mu (U+03BC) fold to "u" (Helvetica has no mu glyph). */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/[\u2018\u2019\u201B]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/[\u00B5\u03BC]/g, 'u')
    .replace(/\u00A0/g, ' ')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u2028\u2029\uFEFF]/g, '');
};

const KEY_OVERRIDES = {
  od: 'OD', os: 'OS', ou: 'OU', rapd: 'RAPD', iop: 'IOP', oct: 'OCT',
  rnfl: 'RNFL', pas: 'PAS', erm: 'ERM', elm: 'ELM', eom: 'EOM',
  cct: 'CCT', inl: 'INL', onl: 'ONL', vegf: 'VEGF',
};
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  const lower = String(key).toLowerCase();
  if (KEY_OVERRIDES[lower]) return KEY_OVERRIDES[lower];
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.split(' ').map(w => { const l = w.toLowerCase(); return KEY_OVERRIDES[l] || (w.charAt(0).toUpperCase() + w.slice(1)); }).join(' ');
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
const isScalar = (v) => v === null || typeof v !== 'object';
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };

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

/* splitBySentence: canonical + \d guard (do NOT split mid-list on a "1." number-dot) + leading "N." strip */
const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|[A-Z]|\d))[.;](?:\s+)/).map(s => s.trim().replace(/^\d+\.\s+/, '')).filter(s => s && !/^[;.,!?]+$/.test(s));
};

const strip = (s) => safeString(s).replace(/^\s*\d+\.\s+/, '').replace(/[;.]+$/, '').trim();

/* sentenceRows: splitBySentence -> parseLabel -> splitByComma (decompose nested "Label: value") */
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

/* objectRows: generic recursive renderer for nested objects/arrays. Each key renders as a subLabel
   ABOVE its value (label-above-value, mirroring the JSX) so every nested key is a distinct >Label< node. */
const objectRows = (obj, kp) => {
  const rows = [];
  Object.entries(obj).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v], i) => {
    const key = `${kp}-${k}-${i}`;
    if (isScalar(v)) {
      rows.push(<Text key={`${key}-l`} style={styles.subLabel}>{safeString(humanizeKey(k))}</Text>);
      rows.push(<Text key={key} style={styles.value}>{safeString(fmtScalar(v))}</Text>);
    } else if (Array.isArray(v)) {
      rows.push(<Text key={`${key}-l`} style={styles.subLabel}>{safeString(humanizeKey(k))}</Text>);
      v.filter(x => !isEmptyDeep(x)).forEach((it, j) => rows.push(
        isScalar(it)
          ? <Text key={`${key}-${j}`} style={styles.value}>{`${j + 1}. ${strip(it)}`}</Text>
          : <View key={`${key}-${j}`}>{objectRows(it, `${key}-${j}`)}</View>
      ));
    } else {
      rows.push(<Text key={`${key}-l`} style={styles.subLabel}>{safeString(humanizeKey(k))}</Text>);
      rows.push(...objectRows(v, key));
    }
  });
  return rows;
};

/* arrayRows: array of scalars -> decompose labeled items (subLabel above value), number the rest */
const arrayRows = (arr, kp) => {
  const rows = [];
  arr.filter(x => !isEmptyDeep(x)).forEach((item, i) => {
    if (!isScalar(item)) { rows.push(<View key={`${kp}-${i}`}>{objectRows(item, `${kp}-${i}`)}</View>); return; }
    const p = parseLabel(fmtScalar(item));
    if (p.isLabeled) {
      rows.push(<Text key={`${kp}-${i}-l`} style={styles.subLabel}>{safeString(p.label)}</Text>);
      rows.push(<Text key={`${kp}-${i}-v`} style={styles.value}>{strip(p.value)}</Text>);
    } else {
      rows.push(<Text key={`${kp}-${i}`} style={styles.value}>{`${i + 1}. ${strip(item)}`}</Text>);
    }
  });
  return rows;
};

const fieldBody = (record, f) => {
  const v = record[f];
  if (DATE_FIELDS.includes(f)) return [<Text key="v" style={styles.value}>{safeString(formatDate(v))}</Text>];
  if (NUMBER_FIELDS.includes(f)) return [<Text key="v" style={styles.value}>{safeString(String(v))}</Text>];
  if (Array.isArray(v)) return arrayRows(v, f);
  if (v && typeof v === 'object') return objectRows(v, f);
  const rows = sentenceRows(String(v));
  if (rows.length === 0) return [<Text key="v" style={styles.value}>{safeString(String(v))}</Text>];
  return rows.map((r, i) => r.type === 'sub'
    ? <Text key={i} style={styles.subLabel}>{safeString(r.text)}</Text>
    : <Text key={i} style={styles.value}>{strip(r.text)}</Text>);
};

/* renderSection: the section title + field label + FIRST body row ride together in a small
   wrap={false} View (glued - no orphaned title). The rest of a field body (a deeply-nested
   object like fundoscopy/oct can be page-tall) flows in a normal breakable View so it never
   trips react-pdf's "wrap={false} node bigger than page" warning. */
const renderSection = (record, sid) => {
  const fields = SECTION_FIELDS[sid] || [];
  const present = fields.filter(f => hasVal(record[f]));
  if (present.length === 0) return null;
  const sectionTitle = SECTION_TITLES[sid];
  const out = [];
  present.forEach((f, i) => {
    const label = FIELD_LABELS[f] || f;
    const showLabel = label.trim().toLowerCase() !== (sectionTitle || '').trim().toLowerCase();
    const body = fieldBody(record, f);
    const first = body.length ? body[0] : null;
    const rest = body.length > 1 ? body.slice(1) : [];
    out.push(
      <View key={`${f}-h`} style={styles.fieldWrap} wrap={false}>
        {i === 0 && <Text style={styles.sectionTitle}>{safeString(sectionTitle)}</Text>}
        {showLabel && <Text style={styles.fieldLabel}>{safeString(label)}</Text>}
        {first}
      </View>
    );
    if (rest.length) out.push(<View key={`${f}-b`} style={styles.fieldWrap}>{rest}</View>);
  });
  return out;
};

const OphthalmologyExamDocumentPDFTemplate = ({ document: docProp, data = docProp, records: recProp }) => {
  const source = recProp !== undefined ? recProp : data;
  let records = [];
  if (Array.isArray(source)) records = source;
  else if (source && typeof source === 'object') {
    if (source.ophthalmology_exam) records = Array.isArray(source.ophthalmology_exam) ? source.ophthalmology_exam : [source.ophthalmology_exam];
    else records = [source];
  }
  records = records.filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Ophthalmology Exam</Text>
          <Text style={styles.noData}>No ophthalmology exam records available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Ophthalmology Exam</Text>
        {records.map((record, rIdx) => (
          <View key={rIdx}>
            <Text style={styles.recordTitle} break={rIdx > 0}>{safeString(`Ophthalmology Exam ${rIdx + 1}`)}</Text>
            {SECTION_ORDER.map(sid => renderSection(record, sid))}
          </View>
        ))}
        <Text style={styles.footer} fixed>This document contains Protected Health Information (PHI). Handle in accordance with HIPAA.</Text>
      </Page>
    </Document>
  );
};

export default OphthalmologyExamDocumentPDFTemplate;
