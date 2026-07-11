import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * HospiceNotesDocumentPDFTemplate - box-free canonical (LETTER)
 * Config-driven from the JSX SECTION_TITLES/FIELD_LABELS/SECTION_FIELDS.
 * Renders EVERY populated field the JSX renders (numbers incl. 0; arrays numbered; clinical
 * comma/semicolon lists split to numbered rows) for JSX/PDF field parity.
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
const SECTION_ORDER = ['symptom-assessment', 'clinical-status', 'psychosocial-spiritual', 'plan', 'equipment'];

const SECTION_TITLES = {
  'symptom-assessment': 'Symptom Assessment',
  'clinical-status': 'Clinical Status',
  'psychosocial-spiritual': 'Psychosocial & Spiritual',
  'plan': 'Plan',
  'equipment': 'Equipment',
};

const FIELD_LABELS = {
  comfortScore: 'Comfort Score',
  painScale: 'Pain Scale',
  morphineEquivalentDailyDose: 'Morphine Equivalent Daily Dose',
  performanceStatus: 'Performance Status',
  dyspneaSeverity: 'Dyspnea Severity',
  appetiteAssessment: 'Appetite Assessment',
  sleepPattern: 'Sleep Pattern',
  bowelMovementPattern: 'Bowel Movement Pattern',
  urinaryFunction: 'Urinary Function',
  skinIntegrity: 'Skin Integrity',
  cognitiveStatus: 'Cognitive Status',
  anxietyLevel: 'Anxiety Level',
  spiritualConcerns: 'Spiritual Concerns',
  familyCopingAssessment: 'Family Coping Assessment',
  symptomManagementPlan: 'Symptom Management Plan',
  advanceDirectiveStatus: 'Advance Directive Status',
  medicationAdherence: 'Medication Adherence',
  emergencyContactPlan: 'Emergency Contact Plan',
  prognosisDiscussion: 'Prognosis Discussion',
  interdisciplinaryTeamNotes: 'Interdisciplinary Team Notes',
  equipmentNeeds: 'Equipment Needs',
};

const SECTION_FIELDS = {
  'symptom-assessment': ['painScale', 'comfortScore', 'morphineEquivalentDailyDose', 'performanceStatus', 'dyspneaSeverity', 'appetiteAssessment', 'sleepPattern', 'bowelMovementPattern', 'urinaryFunction'],
  'clinical-status': ['skinIntegrity', 'cognitiveStatus', 'anxietyLevel'],
  'psychosocial-spiritual': ['spiritualConcerns', 'familyCopingAssessment'],
  'plan': ['symptomManagementPlan', 'advanceDirectiveStatus', 'medicationAdherence', 'emergencyContactPlan', 'prognosisDiscussion', 'interdisciplinaryTeamNotes'],
  'equipment': ['equipmentNeeds'],
};

const NUMBER_FIELDS = ['comfortScore', 'painScale', 'morphineEquivalentDailyDose'];
const ARRAY_FIELDS = ['equipmentNeeds'];
const COMMA_LIST_FIELDS = ['performanceStatus', 'dyspneaSeverity', 'appetiteAssessment', 'sleepPattern', 'bowelMovementPattern', 'urinaryFunction', 'skinIntegrity', 'cognitiveStatus', 'anxietyLevel', 'spiritualConcerns', 'familyCopingAssessment', 'symptomManagementPlan', 'advanceDirectiveStatus', 'medicationAdherence', 'emergencyContactPlan', 'prognosisDiscussion', 'interdisciplinaryTeamNotes'];

/* HELPERS (mirror the JSX) — safeString uses ONLY \uXXXX escapes (never literal smart chars) */
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

const fmtVal = (v) => {
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return String(v);
  return String(v || '');
};

// numberShowsPDF: show a NUMBER field whenever it holds a real number — INCLUDING 0 (clinically
// meaningful: 0 pain = no pain, 0 MEDD = no opioids, 0 comfort = lowest comfort). Hide only null/undefined/''.
const numberShowsPDF = (record, field) => {
  const raw = record[field];
  if (raw === null || raw === undefined || raw === '') return false;
  const n = parseFloat(raw);
  return !isNaN(n);
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))[.;](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};

// splitCommaList: split a clinical list on top-level commas AND semicolons — NOT inside parentheses,
// NOT thousands commas between digits (e.g. "1,400").
const splitCommaList = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if ((ch === ';' || ch === ',') && depth === 0 && !(ch === ',' && /\d/.test(text[i - 1] || '') && /\d/.test(text[i + 1] || ''))) {
      const t = current.trim(); if (t) result.push(t); current = '';
    } else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

const strip = (s) => safeString(s).replace(/^\s*\d+\.\s+/, '').replace(/[;.]+$/, '').trim();

// Whether a field has presentable content (number hide-null/'', others hasVal)
const fieldPresent = (record, field) => {
  if (NUMBER_FIELDS.includes(field)) return numberShowsPDF(record, field);
  return hasVal(record[field]);
};

/* fieldBody: number -> value; array -> numbered items; clinical list -> numbered rows;
   otherwise multi-sentence -> numbered rows, single -> value. Mirrors the JSX decomposition. */
const fieldBody = (record, f) => {
  const v = record[f];
  if (NUMBER_FIELDS.includes(f)) return [<Text key="v" style={styles.value}>{safeString(fmtVal(v))}</Text>];
  if (ARRAY_FIELDS.includes(f)) {
    const items = Array.isArray(v) ? v : [v];
    return items.map((it, i) => <Text key={i} style={styles.value}>{i + 1}. {safeString(fmtVal(it))}</Text>);
  }
  if (COMMA_LIST_FIELDS.includes(f)) {
    const items = splitCommaList(fmtVal(v));
    if (items.length > 1) return items.map((it, i) => <Text key={i} style={styles.value}>{i + 1}. {strip(it)}</Text>);
  }
  const strVal = fmtVal(v);
  const sentences = splitBySentence(strVal);
  if (sentences.length > 1) return sentences.map((s, i) => <Text key={i} style={styles.value}>{i + 1}. {strip(s)}</Text>);
  return [<Text key="v" style={styles.value}>{safeString(strVal)}</Text>];
};

const renderSection = (record, sid) => {
  const fields = SECTION_FIELDS[sid] || [];
  const present = fields.filter(f => fieldPresent(record, f));
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

const unwrap = (data) => {
  if (!data) return [];
  if (Array.isArray(data)) {
    if (data.length === 1 && data[0]?.hospice_notes) return Array.isArray(data[0].hospice_notes) ? data[0].hospice_notes : [data[0].hospice_notes];
    return data;
  }
  if (data.hospice_notes) return Array.isArray(data.hospice_notes) ? data.hospice_notes : [data.hospice_notes];
  return [data];
};

const HospiceNotesDocumentPDFTemplate = ({ document: docProp, data = docProp }) => {
  const records = unwrap(data).filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Hospice Notes</Text>
          <Text style={styles.noData}>No hospice notes records available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Hospice Notes</Text>
        {records.map((record, rIdx) => (
          <View key={rIdx}>
            <Text style={styles.recordTitle} break={rIdx > 0}>{safeString(`Hospice Note ${record._recordNumber || rIdx + 1}`)}</Text>
            {SECTION_ORDER.map(sid => renderSection(record, sid))}
          </View>
        ))}
        <Text style={styles.footer} fixed>This document contains Protected Health Information (PHI). Handle in accordance with HIPAA.</Text>
      </Page>
    </Document>
  );
};

export default HospiceNotesDocumentPDFTemplate;
