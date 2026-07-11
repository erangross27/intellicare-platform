import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * InfliximabDrugMonitoringDocumentPDFTemplate - box-free canonical (LETTER)
 * Config-driven from the JSX SECTION_ORDER/SECTION_TITLES/FIELD_LABELS/SECTION_FIELDS.
 * Renders EVERY populated field the JSX renders (numbers incl. 0, boolean as Yes/No, arrays as
 * numbered items) for JSX/PDF field parity. No record date (record has only ingestion timestamps).
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
const SECTION_ORDER = ['drug-levels', 'disease-activity', 'inflammatory-markers', 'safety-labs', 'clinical-assessment', 'planning'];

const SECTION_TITLES = {
  'drug-levels': 'Drug Levels',
  'disease-activity': 'Disease Activity Indices',
  'inflammatory-markers': 'Inflammatory Markers',
  'safety-labs': 'Safety Labs',
  'clinical-assessment': 'Clinical Assessment',
  'planning': 'Planning',
};

const FIELD_LABELS = {
  infliximabDoseAdministered: 'Infliximab Dose Administered (mg)',
  infliximabSerumLevel: 'Infliximab Serum Level (mcg/mL)',
  antiDrugAntibodies: 'Anti-Drug Antibodies (U/mL)',
  crohnsDiseaseActivityIndex: 'Crohn\'s Disease Activity Index (CDAI)',
  harveyBradshawIndex: 'Harvey-Bradshaw Index (HBI)',
  mayoClinicScore: 'Mayo Clinic Score',
  cReactiveProtein: 'C-Reactive Protein (mg/L)',
  erythrocyteSedimentationRate: 'ESR (mm/hr)',
  fecalCalprotectin: 'Fecal Calprotectin (mcg/g)',
  hepaticTransaminases: 'Hepatic Transaminases',
  completeBloodCount: 'Complete Blood Count',
  tuberculosisScreening: 'Tuberculosis Screening',
  hepatitisBSurfaceAntigen: 'Hepatitis B Surface Antigen',
  hepatitisCViralLoad: 'Hepatitis C Viral Load (IU/mL)',
  infusionReactionSeverity: 'Infusion Reaction Severity',
  concomitantImmunosuppression: 'Concomitant Immunosuppression',
  dosageOptimizationRequired: 'Dosage Optimization Required',
  treatmentResponseAssessment: 'Treatment Response Assessment',
  adverseEventProfile: 'Adverse Event Profile',
  nextInfusionDueDate: 'Next Infusion Due Date',
};

const SECTION_FIELDS = {
  'drug-levels': ['infliximabDoseAdministered', 'infliximabSerumLevel', 'antiDrugAntibodies'],
  'disease-activity': ['crohnsDiseaseActivityIndex', 'harveyBradshawIndex', 'mayoClinicScore'],
  'inflammatory-markers': ['cReactiveProtein', 'erythrocyteSedimentationRate', 'fecalCalprotectin'],
  'safety-labs': ['hepaticTransaminases', 'completeBloodCount', 'tuberculosisScreening', 'hepatitisBSurfaceAntigen', 'hepatitisCViralLoad'],
  'clinical-assessment': ['infusionReactionSeverity', 'concomitantImmunosuppression', 'dosageOptimizationRequired', 'treatmentResponseAssessment', 'adverseEventProfile'],
  'planning': ['nextInfusionDueDate'],
};

const NUMBER_FIELDS = [
  'infliximabDoseAdministered', 'infliximabSerumLevel', 'antiDrugAntibodies',
  'crohnsDiseaseActivityIndex', 'harveyBradshawIndex', 'mayoClinicScore',
  'cReactiveProtein', 'erythrocyteSedimentationRate', 'fecalCalprotectin',
  'hepatitisCViralLoad',
];
const BOOLEAN_FIELDS = ['dosageOptimizationRequired'];
const DATE_FIELDS = ['nextInfusionDueDate'];
const ARRAY_FIELDS = ['concomitantImmunosuppression', 'adverseEventProfile'];

/* HELPERS (mirror the JSX). safeString uses ONLY \uXXXX escapes -- NEVER literal smart-quotes/invisible
   chars (a literal U+2028/U+2029/BOM in a regex literal breaks the parser as an unterminated regexp). */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  const RE_SQUOTE = new RegExp('[' + String.fromCharCode(0x2018, 0x2019, 0x201B) + ']', 'g');
  const RE_DQUOTE = new RegExp('[' + String.fromCharCode(0x201C, 0x201D) + ']', 'g');
  const RE_DASH = new RegExp('[' + String.fromCharCode(0x2013, 0x2014) + ']', 'g');
  const RE_ELLIPSIS = new RegExp(String.fromCharCode(0x2026), 'g');
  const RE_NBSP = new RegExp(String.fromCharCode(0x00A0), 'g');
  const RE_INVIS = new RegExp('[' + String.fromCharCode(0x2028, 0x2029, 0xFEFF) + ']', 'g');
  return String(val)
    .replace(RE_SQUOTE, "'")
    .replace(RE_DQUOTE, '"')
    .replace(RE_DASH, '-')
    .replace(RE_ELLIPSIS, '...')
    .replace(RE_NBSP, ' ')
    .replace(RE_INVIS, '');
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
  if (BOOLEAN_FIELDS.includes(f)) return [<Text key="v" style={styles.value}>{v ? 'Yes' : 'No'}</Text>];
  if (NUMBER_FIELDS.includes(f)) return [<Text key="v" style={styles.value}>{safeString(String(v))}</Text>];
  if (ARRAY_FIELDS.includes(f)) {
    const arr = Array.isArray(v) ? v : [v];
    return arr.map((it, i) => <Text key={i} style={styles.value}>{`${i + 1}. ${strip(it)}`}</Text>);
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

const InfliximabDrugMonitoringDocumentPDFTemplate = ({ document: docProp, data = docProp }) => {
  let records = [];
  if (Array.isArray(data)) records = data;
  else if (data && typeof data === 'object') records = [data];
  records = records.filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Infliximab Drug Monitoring</Text>
          <Text style={styles.noData}>No infliximab drug monitoring records available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Infliximab Drug Monitoring</Text>
        {records.map((record, rIdx) => (
          <View key={rIdx}>
            <Text style={styles.recordTitle} break={rIdx > 0}>{safeString(`Infliximab Drug Monitoring ${rIdx + 1}`)}</Text>
            {SECTION_ORDER.map(sid => renderSection(record, sid))}
          </View>
        ))}
        <Text style={styles.footer} fixed>This document contains Protected Health Information (PHI). Handle in accordance with HIPAA.</Text>
      </Page>
    </Document>
  );
};

export default InfliximabDrugMonitoringDocumentPDFTemplate;
