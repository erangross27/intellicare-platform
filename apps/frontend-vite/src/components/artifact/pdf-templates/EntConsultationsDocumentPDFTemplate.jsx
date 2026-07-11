/**
 * EntConsultationsDocumentPDFTemplate.jsx
 * Box-free B&W LETTER — ENT consultations. Mirrors EntConsultationsDocument.jsx (4-area).
 * Collection: ent_consultations
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, backgroundColor: '#ffffff', color: '#000000' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 10, marginBottom: 18, borderBottomWidth: 2, borderBottomColor: '#000000' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 10, marginBottom: 10 },
  field: { marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 3, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000' },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 2, marginBottom: 4, marginTop: 4, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  subLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 2 },
  fieldValue: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#666666' },
});

/* ═══ UTILS (mirror the JSX) ═══ */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'string' ? val : String(val);
  str = str.replace(/µm/g, 'um').replace(/μm/g, 'um').replace(/°/g, ' deg')
    .replace(/±/g, '+/-').replace(/≥/g, '>=').replace(/≤/g, '<=')
    .replace(/→/g, '->').replace(/“/g, '"').replace(/”/g, '"')
    .replace(/‘/g, "'").replace(/’/g, "'").replace(/—/g, '-').replace(/–/g, '-');
  return str;
};

const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; };
const fmtVal = (v) => String(v || '');

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))[.;](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
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
      const next = text[i + 1];
      const after = text.slice(i + 1).trimStart().toLowerCase();
      const beforeWord = (current.trim().split(/\s+/).pop() || '').toLowerCase();
      const keepJoined = (next && next !== ' ') || /^(and|or)\b/.test(after) || beforeWord === 'and' || beforeWord === 'or';
      if (keepJoined) { current += ch; }
      else { const t = current.trim(); if (t) result.push(t); current = ''; }
    }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

/* ═══ CONFIG (mirror the JSX) ═══ */
const SECTION_TITLES = {
  'chief-complaint': 'Chief Complaint',
  'hearing-assessment': 'Hearing Assessment',
  'vestibular-section': 'Vestibular Assessment',
  'ear-examination': 'Ear Examination',
  'nasal-sinus': 'Nasal & Sinus',
  'throat-voice': 'Throat & Voice',
  'neck-sleep': 'Neck & Sleep',
  'imaging-biopsy': 'Imaging & Biopsy',
  'surgical-section': 'Surgical Indications',
};

const FIELD_LABELS = {
  chiefComplaint: 'Chief Complaint',
  audiometryResults: 'Audiometry Results',
  hearingLossType: 'Hearing Loss Type',
  hearingLossSeverity: 'Hearing Loss Severity',
  tinnitusCharacteristics: 'Tinnitus Characteristics',
  vertigoAssessment: 'Vertigo Assessment',
  nystagmusExamination: 'Nystagmus Examination',
  dixHallpikeTest: 'Dix-Hallpike Test',
  tympanometryFindings: 'Tympanometry Findings',
  weberTest: 'Weber Test',
  rinneTest: 'Rinne Test',
  nasalEndoscopyFindings: 'Nasal Endoscopy Findings',
  sinusSymptoms: 'Sinus Symptoms',
  allergicRhinitisHistory: 'Allergic Rhinitis History',
  laryngoscopyFindings: 'Laryngoscopy Findings',
  vocalCordMobility: 'Vocal Cord Mobility',
  voiceQualityAssessment: 'Voice Quality Assessment',
  swallowingDifficulty: 'Swallowing Difficulty',
  neckMassCharacteristics: 'Neck Mass Characteristics',
  sleepApneaScreening: 'Sleep Apnea Screening',
  ctScanFindings: 'CT Scan Findings',
  mriFindings: 'MRI Findings',
  biopsyResults: 'Biopsy Results',
  surgicalIndications: 'Surgical Indications',
};

const SECTION_FIELDS = {
  'chief-complaint': ['chiefComplaint'],
  'hearing-assessment': ['audiometryResults', 'hearingLossType', 'hearingLossSeverity', 'tinnitusCharacteristics'],
  'vestibular-section': ['vertigoAssessment', 'nystagmusExamination', 'dixHallpikeTest'],
  'ear-examination': ['tympanometryFindings', 'weberTest', 'rinneTest'],
  'nasal-sinus': ['nasalEndoscopyFindings', 'sinusSymptoms', 'allergicRhinitisHistory'],
  'throat-voice': ['laryngoscopyFindings', 'vocalCordMobility', 'voiceQualityAssessment', 'swallowingDifficulty'],
  'neck-sleep': ['neckMassCharacteristics', 'sleepApneaScreening'],
  'imaging-biopsy': ['ctScanFindings', 'mriFindings', 'biopsyResults'],
  'surgical-section': ['surgicalIndications'],
};

const SENTENCE_FIELDS = ['audiometryResults', 'nasalEndoscopyFindings', 'allergicRhinitisHistory', 'laryngoscopyFindings', 'sleepApneaScreening', 'ctScanFindings', 'surgicalIndications'];
const STRING_ARRAY_FIELDS = ['sinusSymptoms'];
// measurement fields whose "freq: value" pairs display with a dash ("250 Hz - 30 dB")
const MEASURE_PAIR_FIELDS = ['audiometryResults'];
const dashPair = (s) => (typeof s === 'string' ? s.replace(/^([^:]{1,40}?):\s+/, '$1 - ') : s);

/* field value → array of styled <Text> (mirror formatSentenceFieldLines / copy) */
const fieldContentTexts = (f, val, keyPrefix) => {
  const out = [];
  const fmtP = MEASURE_PAIR_FIELDS.includes(f) ? dashPair : (x => x);
  if (SENTENCE_FIELDS.includes(f)) {
    const sentences = splitBySentence(fmtVal(val));
    let n = 1;
    sentences.forEach((s, si) => {
      const parsed = parseLabel(s);
      if (parsed.isLabeled) {
        out.push(<Text key={`${keyPrefix}-sl${si}`} style={styles.subLabel}>{safeString(parsed.label)}</Text>);
        const parts = splitByComma(parsed.value);
        let m = 1;
        (parts.length >= 2 ? parts : [parsed.value]).forEach((it, i) => out.push(<Text key={`${keyPrefix}-${si}-${i}`} style={styles.fieldValue}>{`${m++}. ${safeString(fmtP(it))}`}</Text>));
      } else {
        const parts = splitByComma(s);
        if (parts.length >= 2) parts.forEach((it, i) => out.push(<Text key={`${keyPrefix}-v${si}-${i}`} style={styles.fieldValue}>{`${n++}. ${safeString(fmtP(it))}`}</Text>));
        else out.push(<Text key={`${keyPrefix}-v${si}`} style={styles.fieldValue}>{`${n++}. ${safeString(fmtP(s))}`}</Text>);
      }
    });
  } else if (STRING_ARRAY_FIELDS.includes(f) && Array.isArray(val)) {
    val.forEach((it, i) => out.push(<Text key={`${keyPrefix}-a${i}`} style={styles.fieldValue}>{`${i + 1}. ${safeString(it)}`}</Text>));
  } else {
    out.push(<Text key={`${keyPrefix}-v`} style={styles.fieldValue}>{`1. ${safeString(fmtVal(val))}`}</Text>);
  }
  return out;
};

/* one section → array of field Views; section title glued to the first present field */
const sectionViews = (record, sid, idx) => {
  const title = SECTION_TITLES[sid];
  const fields = SECTION_FIELDS[sid] || [];
  const present = fields.filter(f => {
    const v = record[f];
    return STRING_ARRAY_FIELDS.includes(f) ? (Array.isArray(v) && v.length > 0) : hasVal(v);
  });
  if (!present.length) return [];
  return present.map((f, i) => {
    const label = FIELD_LABELS[f] || f;
    const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const texts = [];
    if (i === 0) texts.push(<Text key={`${sid}-${idx}-t`} style={styles.sectionTitle}>{title}</Text>);
    if (sl) texts.push(<Text key={`${sid}-${idx}-${f}-l`} style={styles.fieldLabel}>{label}</Text>);
    fieldContentTexts(f, record[f], `${sid}-${idx}-${f}`).forEach(t => texts.push(t));
    return <View key={`${sid}-${idx}-${f}`} wrap={i === 0 ? false : texts.length > 22} style={styles.field}>{texts}</View>;
  });
};

/* ═══ COMPONENT ═══ */
const EntConsultationsDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.ent_consultations) return Array.isArray(r.ent_consultations) ? r.ent_consultations : [r.ent_consultations];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.ent_consultations) return Array.isArray(dd.ent_consultations) ? dd.ent_consultations : [dd.ent_consultations]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>ENT Consultations</Text>
          <Text style={styles.emptyState}>No records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>ENT Consultations</Text>
        {records.flatMap((record, idx) => {
          const els = [<Text key={`rt-${idx}`} style={styles.recordTitle} break={idx > 0}>{`ENT Consultation ${idx + 1}`}</Text>];
          Object.keys(SECTION_FIELDS).forEach(sid => { sectionViews(record, sid, idx).forEach(v => els.push(v)); });
          return els;
        })}
      </Page>
    </Document>
  );
};

export default EntConsultationsDocumentPDFTemplate;
