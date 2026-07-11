/**
 * PeripheralArteryDiseaseDocumentPDFTemplate.jsx
 * Box-free B&W — LETTER size — US medical platform.
 * Config-driven from SECTION_FIELDS so it stays in parity with the JSX. Underline rules:
 *   documentTitle 26pt / 2pt black · sectionTitle 16pt / 1pt black · fieldLabel 12pt / 0.5pt #999.
 * Collection: peripheral_artery_disease
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, backgroundColor: '#ffffff', color: '#000000', lineHeight: 1.5 },
  documentHeader: { marginBottom: 20 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000' },
  recordContainer: { paddingBottom: 18 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 12 },
  section: { marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#000000' },
  fieldBlock: { marginBottom: 10 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#333333', marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  fieldValue: { fontSize: 14, color: '#000000', marginBottom: 2 },
  subLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 2, marginBottom: 1, marginLeft: 8 },
  listItem: { fontSize: 14, color: '#000000', marginBottom: 2, marginLeft: 8 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#666666' },
});

/* ======= CONFIG (mirrors the JSX) ======= */
const SECTION_TITLES = {
  'hemodynamic-indices': 'Hemodynamic Indices',
  'classification': 'Classification & Staging',
  'claudication': 'Claudication Assessment',
  'diagnostic-studies': 'Diagnostic Studies',
  'arterial-anatomy': 'Arterial Anatomy & History',
  'medical-therapy': 'Medical Therapy',
  'risk-assessment': 'Risk Assessment',
};

const FIELD_LABELS = {
  anklebrachialIndex: 'Ankle-Brachial Index',
  toeBrachialIndex: 'Toe-Brachial Index',
  transcutaneousOxygenPressure: 'Transcutaneous Oxygen Pressure',
  skinPerfusionPressure: 'Skin Perfusion Pressure',
  rutherfordClassification: 'Rutherford Classification',
  fontaineClassification: 'Fontaine Classification',
  wIfIScore: 'WIfI Score',
  tasCIILesionClassification: 'TASC II Lesion Classification',
  globalLimbAnatomicStagingSystem: 'Global Limb Anatomic Staging System',
  claudicationDistance: 'Claudication Distance',
  absoluteClaudicationDistance: 'Absolute Claudication Distance',
  segmentalLimbPressures: 'Segmental Limb Pressures',
  pulseVolumeRecordingFindings: 'Pulse Volume Recording Findings',
  duplexUltrasoundFindings: 'Duplex Ultrasound Findings',
  ctAngiographyFindings: 'CT Angiography Findings',
  affectedArterialSegments: 'Affected Arterial Segments',
  previousRevascularizationHistory: 'Previous Revascularization History',
  antiplateletTherapy: 'Antiplatelet Therapy',
  cilostazolTherapy: 'Cilostazol Therapy',
  statinIntensity: 'Statin Intensity',
  supervisedExerciseTherapy: 'Supervised Exercise Therapy',
  cardiovascularRiskFactors: 'Cardiovascular Risk Factors',
  chronicLimbThreateningIschemia: 'Chronic Limb-Threatening Ischemia',
  acuteLimbIschemiaCategory: 'Acute Limb Ischemia Category',
  amputationRisk: 'Amputation Risk',
};

const SECTION_FIELDS = {
  'hemodynamic-indices': ['anklebrachialIndex', 'toeBrachialIndex', 'transcutaneousOxygenPressure', 'skinPerfusionPressure'],
  'classification': ['rutherfordClassification', 'fontaineClassification', 'wIfIScore', 'tasCIILesionClassification', 'globalLimbAnatomicStagingSystem'],
  'claudication': ['claudicationDistance', 'absoluteClaudicationDistance'],
  'diagnostic-studies': ['segmentalLimbPressures', 'pulseVolumeRecordingFindings', 'duplexUltrasoundFindings', 'ctAngiographyFindings'],
  'arterial-anatomy': ['affectedArterialSegments', 'previousRevascularizationHistory'],
  'medical-therapy': ['antiplateletTherapy', 'cilostazolTherapy', 'statinIntensity', 'supervisedExerciseTherapy'],
  'risk-assessment': ['cardiovascularRiskFactors', 'chronicLimbThreateningIschemia', 'acuteLimbIschemiaCategory', 'amputationRisk'],
};

const NUMBER_FIELDS = ['anklebrachialIndex', 'toeBrachialIndex', 'claudicationDistance', 'absoluteClaudicationDistance', 'transcutaneousOxygenPressure', 'skinPerfusionPressure'];
const BOOLEAN_FIELDS = ['chronicLimbThreateningIschemia', 'cilostazolTherapy', 'supervisedExerciseTherapy'];
const ARRAY_FIELDS = ['affectedArterialSegments', 'previousRevascularizationHistory', 'cardiovascularRiskFactors'];
/* Numeric measures where 0 is a "not recorded" sentinel — hidden. None here is a meaningful 0. */
const MEANINGFUL_ZERO_FIELDS = [];

/* safeString: \u-escapes only — scrub glyphs Helvetica lacks (×, en/em dash, smart quotes, bullet, BOM). */
const safeString = (s) => String(s == null ? '' : s)
  .replace(/×/g, 'x')
  .replace(/–|—/g, '-')
  .replace(/‘|’/g, "'")
  .replace(/“|”/g, '"')
  .replace(/•/g, '-')
  .replace(/﻿/g, '');

const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; return true; };
const hasFieldVal = (fn, v) => { if (typeof v === 'number' && v === 0 && !MEANINGFUL_ZERO_FIELDS.includes(fn)) return false; return hasVal(v); };
const fmtVal = (v) => (typeof v === 'boolean' ? (v ? 'Yes' : 'No') : safeString(v));

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|[A-Z]))[.;](?:\s+)/).map(s => s.trim().replace(/^\d+\.\s+/, '')).filter(s => s && !/^[;.,!?]+$/.test(s));
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

/* ======= FIELD RENDERERS (sectionTitle rides INSIDE the first field's wrap={false} View) ======= */
const renderSimpleField = (label, value, sectionTitle, key) => (
  <View key={key} style={styles.fieldBlock} wrap={false}>
    {sectionTitle && <Text style={styles.sectionTitle}>{safeString(sectionTitle)}</Text>}
    <Text style={styles.fieldLabel}>{safeString(label)}</Text>
    <Text style={styles.fieldValue}>{fmtVal(value)}</Text>
  </View>
);

const renderArrayField = (label, items, sectionTitle, key) => (
  <View key={key} style={styles.fieldBlock} wrap={sectionTitle ? false : items.length > 12}>
    {sectionTitle && <Text style={styles.sectionTitle}>{safeString(sectionTitle)}</Text>}
    <Text style={styles.fieldLabel}>{safeString(label)}</Text>
    {items.map((it, i) => <Text key={i} style={styles.listItem}>{i + 1}. {safeString(it)}</Text>)}
  </View>
);

const renderSentenceField = (label, text, sectionTitle, key) => {
  const sentences = splitBySentence(safeString(text));
  if (sentences.length === 0) return null;
  const rows = sentences.map(s => {
    const p = parseLabel(s);
    if (p.isLabeled) {
      const items = splitByComma(p.value);
      return { label: p.label, items: items.length >= 2 ? items : [p.value] };
    }
    return { label: null, items: [s.replace(/[;.]+$/, '').trim()] };
  });
  const totalRows = rows.reduce((n, r) => n + r.items.length + (r.label ? 1 : 0), 0);
  return (
    <View key={key} style={styles.fieldBlock} wrap={sectionTitle ? false : totalRows > 12}>
      {sectionTitle && <Text style={styles.sectionTitle}>{safeString(sectionTitle)}</Text>}
      <Text style={styles.fieldLabel}>{safeString(label)}</Text>
      {rows.map((r, i) => (
        <View key={i} wrap={false}>
          {r.label && <Text style={styles.subLabel}>{safeString(r.label)}</Text>}
          {r.items.map((it, j) => <Text key={j} style={styles.listItem}>{j + 1}. {safeString(it)}</Text>)}
        </View>
      ))}
    </View>
  );
};

const renderField = (record, fn, sectionTitle) => {
  const val = record[fn];
  const label = FIELD_LABELS[fn] || fn;
  if (NUMBER_FIELDS.includes(fn) || BOOLEAN_FIELDS.includes(fn)) return renderSimpleField(label, val, sectionTitle, fn);
  if (ARRAY_FIELDS.includes(fn)) {
    const items = Array.isArray(val) ? val.filter(x => x && String(x).trim()) : [];
    return renderArrayField(label, items, sectionTitle, fn);
  }
  return renderSentenceField(label, val, sectionTitle, fn);
};

const renderSection = (record, sid) => {
  const present = (SECTION_FIELDS[sid] || []).filter(f => {
    if (ARRAY_FIELDS.includes(f)) return Array.isArray(record[f]) && record[f].filter(x => x && String(x).trim()).length > 0;
    return hasFieldVal(f, record[f]);
  });
  if (present.length === 0) return null;
  const title = SECTION_TITLES[sid];
  return (
    <View key={sid} style={styles.section}>
      {present.map((f, i) => renderField(record, f, i === 0 ? title : null))}
    </View>
  );
};

const PeripheralArteryDiseaseDocumentPDFTemplate = ({ document: data }) => {
  let records = [];
  if (Array.isArray(data)) {
    records = data;
  } else if (data?.peripheral_artery_disease && Array.isArray(data.peripheral_artery_disease)) {
    records = data.peripheral_artery_disease;
  } else if (data?.documentData) {
    const docData = data.documentData;
    if (Array.isArray(docData)) records = docData;
    else if (docData?.peripheral_artery_disease) records = docData.peripheral_artery_disease;
    else if (docData && typeof docData === 'object') records = [docData];
  } else if (data && typeof data === 'object') {
    records = [data];
  }

  if (!records || records.length === 0) {
    return (<Document><Page size="LETTER" style={styles.page}><View style={styles.documentHeader}><Text style={styles.documentTitle}>Peripheral Artery Disease</Text></View><Text style={styles.emptyState}>No records available</Text></Page></Document>);
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Peripheral Artery Disease</Text></View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <Text style={styles.recordTitle}>{`Peripheral Artery Disease ${idx + 1}`}</Text>
            {Object.keys(SECTION_FIELDS).map(sid => renderSection(record, sid))}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default PeripheralArteryDiseaseDocumentPDFTemplate;
