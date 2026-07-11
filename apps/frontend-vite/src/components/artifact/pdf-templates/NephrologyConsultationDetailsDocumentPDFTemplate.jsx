import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * NephrologyConsultationDetailsDocumentPDFTemplate - box-free canonical (LETTER)
 * Config-driven from the JSX SECTION_ORDER/SECTION_TITLES/FIELD_LABELS/SECTION_FIELDS.
 * Renders EVERY populated field the JSX renders for JSX/PDF field parity.
 * No boxes: underline rules only (documentTitle 2 / recordTitle+sectionTitle 1 / fieldLabel 0.5).
 * kidneyDiseaseProgressionTimeline (array of objects) + dialysisPlanning (3-level nested object)
 * render via a generic recursive renderer; inline "Key: value" is allowed in the PDF only. The
 * timeline is emitted one wrap=false View per element so no oversized block overflows a page.
 * Record date uses record.date (NEVER createdAt/updatedAt).
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
const SECTION_ORDER = ['record-info', 'progression', 'dialysis-planning', 'prognosis', 'assessment', 'plan'];

const SECTION_TITLES = {
  'record-info': 'Record Information',
  'progression': 'Kidney Disease Progression Timeline',
  'dialysis-planning': 'Dialysis Planning',
  'prognosis': 'Prognosis Discussion',
  'assessment': 'Assessment',
  'plan': 'Plan',
};

const FIELD_LABELS = {
  date: 'Date',
  provider: 'Provider',
  facility: 'Facility',
  status: 'Status',
  kidneyDiseaseProgressionTimeline: 'Kidney Disease Progression Timeline',
  estimatedTimeToDialysis: 'Estimated Time to Dialysis',
  dialysisPlanning: 'Dialysis Planning',
  prognosisDiscussion: 'Prognosis Discussion',
  assessment: 'Assessment',
  plan: 'Plan',
};

const SECTION_FIELDS = {
  'record-info': ['date', 'provider', 'facility', 'status'],
  'progression': ['kidneyDiseaseProgressionTimeline'],
  'dialysis-planning': ['estimatedTimeToDialysis', 'dialysisPlanning'],
  'prognosis': ['prognosisDiscussion'],
  'assessment': ['assessment'],
  'plan': ['plan'],
};

const DATE_FIELDS = ['date'];
const NUMBER_FIELDS = [];
const OBJECT_ARRAY_FIELDS = ['kidneyDiseaseProgressionTimeline'];

/* HELPERS (mirror the JSX) - safeString uses ONLY \uXXXX escapes for special chars */
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

const KEY_OVERRIDES = {
  egfr: 'eGFR', uacr: 'UACR', gfr: 'GFR', ckd: 'CKD', esrd: 'ESRD', rrt: 'RRT',
  bp: 'BP', av: 'AV', picc: 'PICC', iga: 'IgA', dka: 'DKA', ecg: 'ECG', mest: 'MEST',
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

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|[A-Z]))[.;](?:\s+)/).map(s => s.trim().replace(/^\d+\.\s+/, '')).filter(s => s && !/^[;.,!?]+$/.test(s));
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

/* objectRows: generic recursive renderer for nested objects/arrays (inline "Key: value" allowed in PDF) */
const objectRows = (obj, kp) => {
  const rows = [];
  Object.entries(obj).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v], i) => {
    const key = `${kp}-${k}-${i}`;
    if (isScalar(v)) {
      rows.push(<Text key={key} style={styles.value}>{safeString(`${humanizeKey(k)}: ${fmtScalar(v)}`)}</Text>);
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

const fieldBody = (record, f) => {
  const v = record[f];
  if (DATE_FIELDS.includes(f)) return [<Text key="v" style={styles.value}>{safeString(formatDate(v))}</Text>];
  if (NUMBER_FIELDS.includes(f)) return [<Text key="v" style={styles.value}>{safeString(String(v))}</Text>];
  if (v && typeof v === 'object' && !Array.isArray(v)) return objectRows(v, f);
  const rows = sentenceRows(String(v));
  if (rows.length === 0) return [<Text key="v" style={styles.value}>{safeString(String(v))}</Text>];
  return rows.map((r, i) => r.type === 'sub'
    ? <Text key={i} style={styles.subLabel}>{safeString(r.text)}</Text>
    : <Text key={i} style={styles.value}>{strip(r.text)}</Text>);
};

/* renderSection: flat field rows, box-free. Section title rides inside the FIRST field's own
   wrap=false View (glued). An OBJECT_ARRAY field is emitted one wrap=false View per element so a
   long timeline flows across pages without ever putting an oversized block in a single wrap=false View. */
const renderSection = (record, sid) => {
  const fields = SECTION_FIELDS[sid] || [];
  const present = fields.filter(f => hasVal(record[f]));
  if (present.length === 0) return null;
  const sectionTitle = SECTION_TITLES[sid];
  const out = [];
  present.forEach((f, i) => {
    const label = FIELD_LABELS[f] || f;
    const showLabel = label.trim().toLowerCase() !== (sectionTitle || '').trim().toLowerCase();
    if (OBJECT_ARRAY_FIELDS.includes(f)) {
      const items = (Array.isArray(record[f]) ? record[f] : []).filter(x => !isEmptyDeep(x));
      items.forEach((item, j) => {
        out.push(
          <View key={`${f}-${j}`} style={styles.fieldWrap} wrap={false}>
            {i === 0 && j === 0 && <Text style={styles.sectionTitle}>{safeString(sectionTitle)}</Text>}
            {j === 0 && showLabel && <Text style={styles.fieldLabel}>{safeString(label)}</Text>}
            {objectRows(item, `${f}-${j}`)}
          </View>
        );
      });
    } else {
      out.push(
        <View key={f} style={styles.fieldWrap} wrap={false}>
          {i === 0 && <Text style={styles.sectionTitle}>{safeString(sectionTitle)}</Text>}
          {showLabel && <Text style={styles.fieldLabel}>{safeString(label)}</Text>}
          {fieldBody(record, f)}
        </View>
      );
    }
  });
  return out;
};

const NephrologyConsultationDetailsDocumentPDFTemplate = ({ document: docProp, data = docProp }) => {
  let records = [];
  if (Array.isArray(data)) records = data;
  else if (data && typeof data === 'object') {
    if (data.nephrology_consultation_details) records = Array.isArray(data.nephrology_consultation_details) ? data.nephrology_consultation_details : [data.nephrology_consultation_details];
    else records = [data];
  }
  records = records.filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Nephrology Consultation Details</Text>
          <Text style={styles.noData}>No nephrology consultation details records available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Nephrology Consultation Details</Text>
        {records.map((record, rIdx) => (
          <View key={rIdx}>
            <Text style={styles.recordTitle} break={rIdx > 0}>{safeString(`Nephrology Consultation Details ${rIdx + 1}`)}</Text>
            {SECTION_ORDER.map(sid => renderSection(record, sid))}
          </View>
        ))}
        <Text style={styles.footer} fixed>This document contains Protected Health Information (PHI). Handle in accordance with HIPAA.</Text>
      </Page>
    </Document>
  );
};

export default NephrologyConsultationDetailsDocumentPDFTemplate;
