import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * InflammatoryBowelReportsDocumentPDFTemplate - box-free canonical (LETTER)
 * Config-driven from the JSX SECTION_ORDER/SECTION_TITLES/FIELD_LABELS/SECTION_FIELDS.
 * Renders EVERY populated field the JSX renders (numbers incl. 0, booleans as Yes/No, array
 * items each as a value row) for JSX/PDF field parity. No record date (this record has none).
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
const SECTION_ORDER = ['session-info', 'disease-activity', 'lab-markers', 'body-metrics', 'manifestations'];

const SECTION_TITLES = {
  'session-info': 'Session Information',
  'disease-activity': 'Disease Activity Scores',
  'lab-markers': 'Laboratory Markers',
  'body-metrics': 'Body Metrics & Clinical Findings',
  'manifestations': 'Extraintestinal Manifestations',
};

const FIELD_LABELS = {
  montrealClassification: 'Montreal Classification',
  parisClassification: 'Paris Classification',
  ileocolonicAnatomy: 'Ileocolonic Anatomy',
  rectalBleedingSeverity: 'Rectal Bleeding Severity',
  perirectalDisease: 'Perirectal Disease',
  crohnsDiseasesActivityIndex: "Crohn's Disease Activity Index (CDAI)",
  mayoEndoscopicScore: 'Mayo Endoscopic Score',
  simpleEndoscopicScore: 'Simple Endoscopic Score (SES-CD)',
  wellBeingGeneralScore: 'Well-Being General Score',
  bowelMovementsPerDay: 'Bowel Movements Per Day',
  fecalCalprotectinLevel: 'Fecal Calprotectin (mcg/g)',
  fecalLactoferrinLevel: 'Fecal Lactoferrin (mcg/g)',
  cReactiveProteinLevel: 'C-Reactive Protein (mg/L)',
  erythrocyteSedimentationRate: 'Erythrocyte Sedimentation Rate (mm/hr)',
  albuminLevel: 'Albumin (g/dL)',
  hemoglobinLevel: 'Hemoglobin (g/dL)',
  hematocritValue: 'Hematocrit (%)',
  bodyWeightKg: 'Body Weight (kg)',
  idealBodyWeightRatio: 'Ideal Body Weight Ratio',
  abdominalMassPresence: 'Abdominal Mass Presence',
  opiateUseForAbdominalPain: 'Opiate Use for Abdominal Pain',
  endoscopicRemissionAchieved: 'Endoscopic Remission Achieved',
  arthropathicManifestations: 'Arthropathic Manifestations',
};

const SECTION_FIELDS = {
  'session-info': ['montrealClassification', 'parisClassification', 'ileocolonicAnatomy', 'rectalBleedingSeverity', 'perirectalDisease'],
  'disease-activity': ['crohnsDiseasesActivityIndex', 'mayoEndoscopicScore', 'simpleEndoscopicScore', 'wellBeingGeneralScore', 'bowelMovementsPerDay'],
  'lab-markers': ['fecalCalprotectinLevel', 'fecalLactoferrinLevel', 'cReactiveProteinLevel', 'erythrocyteSedimentationRate', 'albuminLevel', 'hemoglobinLevel', 'hematocritValue'],
  'body-metrics': ['bodyWeightKg', 'idealBodyWeightRatio', 'abdominalMassPresence', 'opiateUseForAbdominalPain', 'endoscopicRemissionAchieved'],
  'manifestations': ['arthropathicManifestations'],
};

const NUMBER_FIELDS = [
  'crohnsDiseasesActivityIndex', 'mayoEndoscopicScore', 'simpleEndoscopicScore',
  'fecalCalprotectinLevel', 'fecalLactoferrinLevel', 'bowelMovementsPerDay',
  'cReactiveProteinLevel', 'erythrocyteSedimentationRate', 'albuminLevel',
  'hemoglobinLevel', 'wellBeingGeneralScore', 'hematocritValue',
  'bodyWeightKg', 'idealBodyWeightRatio',
];
const BOOLEAN_FIELDS = ['abdominalMassPresence', 'opiateUseForAbdominalPain', 'endoscopicRemissionAchieved'];
const ARRAY_FIELDS = ['arthropathicManifestations'];
const DATE_FIELDS = [];

/* HELPERS (mirror the JSX). safeString: char classes built at runtime from char CODES so the SOURCE
   stays pure ASCII - NEVER a literal smart-quote/invisible char in a regex (which causes an
   "Unterminated regular expression" and fails the audit PDF render). Equivalent to the \uXXXX form. */
const C = (code) => String.fromCharCode(code);
const RANGE = (a, b) => C(a) + '-' + C(b);
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(new RegExp('[' + C(0x2018) + C(0x2019) + C(0x201B) + ']', 'g'), "'")
    .replace(new RegExp('[' + C(0x201C) + C(0x201D) + ']', 'g'), '"')
    .replace(new RegExp('[' + C(0x2013) + C(0x2014) + ']', 'g'), '-')
    .replace(new RegExp(C(0x2026), 'g'), '...')
    .replace(new RegExp(C(0x00A0), 'g'), ' ')
    .replace(new RegExp('[' + RANGE(0x0000, 0x0008) + C(0x000B) + C(0x000C) + RANGE(0x000E, 0x001F) + C(0x2028) + C(0x2029) + C(0xFEFF) + ']', 'g'), '');
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
  if (BOOLEAN_FIELDS.includes(f)) return [<Text key="v" style={styles.value}>{v ? 'Yes' : 'No'}</Text>];
  if (ARRAY_FIELDS.includes(f)) {
    const items = Array.isArray(v) ? v.filter(it => hasVal(it)) : [];
    return items.map((it, i) => <Text key={i} style={styles.value}>{strip(String(it))}</Text>);
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

const InflammatoryBowelReportsDocumentPDFTemplate = ({ document: docProp, data = docProp }) => {
  let records = [];
  if (Array.isArray(data)) records = data;
  else if (data && typeof data === 'object') records = [data];
  records = records.filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Inflammatory Bowel Reports</Text>
          <Text style={styles.noData}>No inflammatory bowel report records available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Inflammatory Bowel Reports</Text>
        {records.map((record, rIdx) => (
          <View key={rIdx}>
            <Text style={styles.recordTitle} break={rIdx > 0}>{safeString(`Inflammatory Bowel Report ${rIdx + 1}`)}</Text>
            {SECTION_ORDER.map(sid => renderSection(record, sid))}
          </View>
        ))}
        <Text style={styles.footer} fixed>This document contains Protected Health Information (PHI). Handle in accordance with HIPAA.</Text>
      </Page>
    </Document>
  );
};

export default InflammatoryBowelReportsDocumentPDFTemplate;
