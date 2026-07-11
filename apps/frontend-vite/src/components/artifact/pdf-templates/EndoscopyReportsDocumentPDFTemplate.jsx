import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * Endoscopy Reports Document PDF Template — box-free B&W LETTER (July 2026 one-pass)
 * Mirrors the JSX SECTION_FIELDS / FIELD_LABELS / SECTION_TITLES. Flatten-under-Page
 * (record title + section field Views are DIRECT <Page> children) so a single record
 * never leaves an empty first page. Accepts `records` (from the JSX) or `document`.
 */

const styles = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 40, paddingHorizontal: 44, fontFamily: 'Helvetica', fontSize: 12, backgroundColor: '#ffffff', color: '#000000' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 8, marginBottom: 16, borderBottomWidth: 2, borderBottomColor: '#000000' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 3, marginTop: 10, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000' },
  field: { marginBottom: 10 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 2, marginBottom: 4, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  subLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 2, marginTop: 5, marginBottom: 3, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  fieldValue: { fontSize: 14, color: '#000000', lineHeight: 1.4, marginBottom: 3, paddingLeft: 4 },
  noData: { fontSize: 12, color: '#666666', marginTop: 40 },
});

/* ═══════ SCHEMA (mirrors the JSX) ═══════ */
const SECTION_ORDER = ['procedure-overview', 'preparation-quality', 'findings', 'biopsy-testing', 'polyps-interventions', 'complications', 'photodocumentation', 'followup'];
const SECTION_TITLES = {
  'procedure-overview': 'Procedure Overview',
  'preparation-quality': 'Preparation & Quality',
  'findings': 'Findings',
  'biopsy-testing': 'Biopsy & Testing',
  'polyps-interventions': 'Polyps & Interventions',
  'complications': 'Complications',
  'photodocumentation': 'Photodocumentation',
  'followup': 'Follow-Up Recommendations',
};
const SECTION_FIELDS = {
  'procedure-overview': ['procedureType', 'indicationForProcedure', 'sedationType', 'endoscopeType', 'completenessOfExamination', 'procedureDuration'],
  'preparation-quality': ['bowelPreparation', 'cecalIntubationAchieved', 'withdrawalTime', 'retroflexionPerformed', 'adenomaDetectionRate'],
  'findings': ['esophagitis', 'barrettEsophagus', 'varicesGrade', 'mucosal', 'anatomicalLandmarks'],
  'biopsy-testing': ['biopsyLocations', 'helicobacterPyloriTesting'],
  'polyps-interventions': ['polypectomyPerformed', 'polypsDetected', 'therapeuticInterventions'],
  'complications': ['complications'],
  'photodocumentation': ['photodocumentation'],
  'followup': ['followUpRecommendations'],
};
const FIELD_LABELS = {
  procedureType: 'Procedure Type', indicationForProcedure: 'Indication', sedationType: 'Sedation Type',
  endoscopeType: 'Endoscope Type', completenessOfExamination: 'Completeness of Examination', procedureDuration: 'Procedure Duration',
  bowelPreparation: 'Bowel Preparation', cecalIntubationAchieved: 'Cecal Intubation Achieved', withdrawalTime: 'Withdrawal Time',
  retroflexionPerformed: 'Retroflexion Performed', adenomaDetectionRate: 'Adenoma Detection Rate',
  esophagitis: 'Esophagitis', barrettEsophagus: 'Barrett Esophagus', varicesGrade: 'Varices Grade', mucosal: 'Mucosal Assessment',
  anatomicalLandmarks: 'Anatomical Landmarks', biopsyLocations: 'Biopsy Locations', helicobacterPyloriTesting: 'Helicobacter Pylori Testing',
  polypectomyPerformed: 'Polypectomy Performed', polypsDetected: 'Polyps Detected', therapeuticInterventions: 'Therapeutic Interventions',
  complications: 'Complications', photodocumentation: 'Photodocumentation', followUpRecommendations: 'Follow-Up Recommendations',
};
const SENTENCE_FIELDS = ['indicationForProcedure', 'helicobacterPyloriTesting', 'followUpRecommendations', 'barrettEsophagus', 'mucosal'];
const BOOLEAN_FIELDS = ['cecalIntubationAchieved', 'polypectomyPerformed', 'retroflexionPerformed'];
const NUMBER_FIELDS = ['withdrawalTime', 'procedureDuration', 'adenomaDetectionRate'];
const ARRAY_FIELDS = ['anatomicalLandmarks', 'biopsyLocations', 'polypsDetected', 'therapeuticInterventions', 'complications', 'photodocumentation'];

/* ═══════ HELPERS ═══════ */
const safeString = (val) => (val === null || val === undefined ? '' : String(val).trim());

const splitIntoSentences = (text) => {
  if (!text || typeof text !== 'string') return [];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if ((ch === '.' || ch === ';') && depth === 0 && i + 1 < text.length && /\s/.test(text[i + 1])) {
      if (ch === '.' && (/\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|etc)$/.test(current) || /(?:^|\s)[A-Z]$/.test(current))) { current += ch; continue; }
      const t = current.trim(); if (t) result.push(t);
      current = '';
      while (i + 1 < text.length && /\s/.test(text[i + 1])) i++;
    } else { current += ch; }
  }
  const t = current.replace(/[.;]+$/, '').trim(); if (t) result.push(t);
  return result;
};
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
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
      const nextCh = text[i + 1] || '';
      const rest = text.slice(i + 1).replace(/^\s+/, '');
      if (/\d/.test(nextCh) || /^(and|or)\b/i.test(rest)) { current += ch; }
      else { const t = current.trim(); if (t) result.push(t); current = ''; }
    }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

/* sentence field → typed lines (box-free: no DASH text; sub-labels carry the underline) */
const sentenceLines = (text) => {
  const out = []; let n = 1;
  splitIntoSentences(text).forEach(s => {
    const p = parseLabel(s);
    const items = splitByComma(p.isLabeled ? p.value : s);
    if (p.isLabeled) {
      out.push({ isLabel: true, text: p.label });
      let m = 1;
      (items.length >= 2 ? items : [p.value]).forEach(it => out.push({ isLabel: false, text: `${m++}. ${it}` }));
    } else if (items.length >= 2) {
      items.forEach(it => out.push({ isLabel: false, text: `${n++}. ${it}` }));
    } else { out.push({ isLabel: false, text: `${n++}. ${s}` }); }
  });
  return out;
};

/* ═══════ FIELD RENDERER → array of <View> (sectionTitle rides the first present field's View) ═══════ */
const renderField = (record, f, sid, idx, sectionTitle) => {
  const label = FIELD_LABELS[f] || f;
  const showLabel = label.toLowerCase() !== (SECTION_TITLES[sid] || '').toLowerCase();
  const titleEl = sectionTitle ? <Text style={styles.sectionTitle}>{sectionTitle}</Text> : null;
  const key = `${idx}-${f}`;
  const val = record[f];

  if (SENTENCE_FIELDS.includes(f)) {
    if (!val || typeof val !== 'string' || !val.trim()) return null;
    const lines = sentenceLines(val); if (!lines.length) return null;
    return [(
      <View key={key} wrap={lines.length > 8} style={styles.field}>
        {titleEl}
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        {lines.map((ln, i) => <Text key={i} style={ln.isLabel ? styles.subLabel : styles.fieldValue}>{ln.text}</Text>)}
      </View>
    )];
  }

  if (ARRAY_FIELDS.includes(f)) {
    const items = Array.isArray(val) ? val.filter(Boolean) : [];
    if (!items.length) return null;
    return [(
      <View key={key} wrap={items.length > 12} style={styles.field}>
        {titleEl}
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        {items.map((it, i) => <Text key={i} style={styles.fieldValue}>{`${i + 1}. ${safeString(it)}`}</Text>)}
      </View>
    )];
  }

  if (BOOLEAN_FIELDS.includes(f)) {
    if (val === null || val === undefined) return null;
    const bv = val === true || val === 'true' || val === 'Yes';
    return [(
      <View key={key} wrap={false} style={styles.field}>
        {titleEl}
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        <Text style={styles.fieldValue}>{`1. ${bv ? 'Yes' : 'No'}`}</Text>
      </View>
    )];
  }

  if (NUMBER_FIELDS.includes(f)) {
    const n = typeof val === 'number' ? val : parseFloat(val);
    if (isNaN(n) || n === 0) return null;
    return [(
      <View key={key} wrap={false} style={styles.field}>
        {titleEl}
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        <Text style={styles.fieldValue}>{`1. ${n}`}</Text>
      </View>
    )];
  }

  // default (plain text)
  if (val === null || val === undefined || (typeof val === 'string' && !val.trim())) return null;
  return [(
    <View key={key} wrap={false} style={styles.field}>
      {titleEl}
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      <Text style={styles.fieldValue}>{`1. ${safeString(val)}`}</Text>
    </View>
  )];
};

const unwrapData = (rawData) => {
  if (!rawData) return [];
  if (Array.isArray(rawData)) {
    if (rawData.length === 0) return [];
    if (rawData[0]?.endoscopy_reports && Array.isArray(rawData[0].endoscopy_reports)) return rawData[0].endoscopy_reports;
    return rawData;
  }
  if (rawData.endoscopy_reports && Array.isArray(rawData.endoscopy_reports)) return rawData.endoscopy_reports;
  if (rawData.documentData) return unwrapData(rawData.documentData);
  if (typeof rawData === 'object') return [rawData];
  return [];
};

const EndoscopyReportsDocumentPDFTemplate = ({ records, document: docData }) => {
  const recs = Array.isArray(records) ? records : unwrapData(docData);

  if (!recs || recs.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Endoscopy Reports</Text>
          <Text style={styles.noData}>No endoscopy reports available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Endoscopy Reports</Text>
        {recs.flatMap((record, idx) => {
          const els = [<Text key={`rt-${idx}`} style={styles.recordTitle} break={idx > 0}>{`Endoscopy Report ${idx + 1}`}</Text>];
          SECTION_ORDER.forEach(sid => {
            const fields = SECTION_FIELDS[sid] || [];
            const sectionViews = [];
            let firstAssigned = false;
            fields.forEach(f => {
              const views = renderField(record, f, sid, idx, firstAssigned ? null : SECTION_TITLES[sid]);
              if (views && views.length) { sectionViews.push(...views); firstAssigned = true; }
            });
            if (sectionViews.length) els.push(...sectionViews);
          });
          return els;
        })}
      </Page>
    </Document>
  );
};

export default EndoscopyReportsDocumentPDFTemplate;
