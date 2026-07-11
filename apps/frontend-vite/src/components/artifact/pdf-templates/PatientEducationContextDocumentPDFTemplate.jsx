import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * PatientEducationContextDocumentPDFTemplate - box-free canonical (LETTER)
 * Config-driven from the JSX SECTION_TITLES / FIELD_LABELS / SECTION_FIELDS.
 * Renders EVERY populated field the JSX renders (arrays, sentence blobs, simple strings)
 * for JSX/PDF field parity. hide-zero mirrors the JSX (educationDurationMinutes=0 => hidden).
 * The top-level `date` renders as a date line under the record title (NOT in any section).
 * No boxes: underline rules only (documentTitle 2 / recordTitle+sectionTitle 1 / fieldLabel 0.5).
 */

const styles = StyleSheet.create({
  page: { padding: 40, paddingBottom: 64, fontFamily: 'Helvetica', fontSize: 14, backgroundColor: '#ffffff', color: '#000000', lineHeight: 1.4 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', marginBottom: 16, paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', marginTop: 14, marginBottom: 4, paddingBottom: 5, borderBottomWidth: 1, borderBottomColor: '#000000' },
  recordDate: { fontSize: 12, color: '#444444', marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginTop: 10, marginBottom: 6, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000' },
  fieldWrap: { marginBottom: 8 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginTop: 6, marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  subLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginTop: 4, marginBottom: 2 },
  value: { fontSize: 14, paddingLeft: 8, marginBottom: 3, lineHeight: 1.4 },
  footer: { position: 'absolute', bottom: 24, left: 40, right: 40, fontSize: 9, color: '#666666', textAlign: 'center', borderTopWidth: 0.5, borderTopColor: '#cccccc', paddingTop: 6 },
  noData: { fontSize: 14, textAlign: 'center', marginTop: 40, color: '#666666' },
});

/* CONFIG (mirrors the JSX) */
const SECTION_ORDER = ['session-overview', 'teaching-method', 'comprehension-engagement', 'content-covered', 'follow-up'];

const SECTION_TITLES = {
  'session-overview': 'Session Overview',
  'teaching-method': 'Teaching Method',
  'comprehension-engagement': 'Comprehension and Engagement',
  'content-covered': 'Content Covered',
  'follow-up': 'Follow-Up',
};

const FIELD_LABELS = {
  provider: 'Provider',
  facility: 'Facility',
  educationalTopicCategory: 'Topic Category',
  specificConditionTaught: 'Condition Taught',
  educationDurationMinutes: 'Duration (minutes)',
  educationMethodUsed: 'Education Method',
  materialsProvided: 'Materials Provided',
  languageOfInstruction: 'Language of Instruction',
  interpreterUsed: 'Interpreter Used',
  demonstrationPerformed: 'Demonstration Performed',
  returnDemonstrationCompleted: 'Return Demonstration Completed',
  healthLiteracyLevel: 'Health Literacy Level',
  learningBarriers: 'Learning Barriers',
  patientComprehensionLevel: 'Comprehension Level',
  teachBackPerformed: 'Teach-Back Performed',
  teachBackSuccessful: 'Teach-Back Successful',
  patientEngagementLevel: 'Engagement Level',
  reinforcementNeeded: 'Reinforcement Needed',
  familyMembersPresent: 'Family Members Present',
  culturalConsiderations: 'Cultural Considerations',
  medicationsEducated: 'Medications Educated',
  sideEffectsDiscussed: 'Side Effects Discussed',
  selfManagementSkillsTaught: 'Self-Management Skills Taught',
  dietaryRestrictions: 'Dietary Restrictions',
  activityLimitations: 'Activity Limitations',
  warningSignsEducated: 'Warning Signs Educated',
  followUpInstructions: 'Follow-Up Instructions',
};

const SECTION_FIELDS = {
  'session-overview': ['provider', 'facility', 'educationalTopicCategory', 'specificConditionTaught', 'educationDurationMinutes'],
  'teaching-method': ['educationMethodUsed', 'materialsProvided', 'languageOfInstruction', 'interpreterUsed', 'demonstrationPerformed', 'returnDemonstrationCompleted'],
  'comprehension-engagement': ['healthLiteracyLevel', 'learningBarriers', 'patientComprehensionLevel', 'teachBackPerformed', 'teachBackSuccessful', 'patientEngagementLevel', 'reinforcementNeeded', 'familyMembersPresent', 'culturalConsiderations'],
  'content-covered': ['medicationsEducated', 'sideEffectsDiscussed', 'selfManagementSkillsTaught', 'dietaryRestrictions', 'activityLimitations', 'warningSignsEducated'],
  'follow-up': ['followUpInstructions'],
};

const ARRAY_FIELDS = ['materialsProvided', 'learningBarriers', 'familyMembersPresent', 'medicationsEducated', 'sideEffectsDiscussed', 'selfManagementSkillsTaught', 'dietaryRestrictions', 'activityLimitations', 'warningSignsEducated'];
const SENTENCE_FIELDS = ['followUpInstructions', 'culturalConsiderations', 'reinforcementNeeded'];
const NUMBER_FIELDS = ['educationDurationMinutes'];
/* educationDurationMinutes: a 0-minute session means duration was not documented -> hidden. */
const HIDE_ZERO_FIELDS = ['educationDurationMinutes'];

/* HELPERS (mirror the JSX) - safeString uses ONLY \uXXXX escapes (NO literal non-ASCII glyphs). */
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
  try { const d = new Date(dateValue.$date || dateValue); if (isNaN(d.getTime())) return String(dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};

/* arrItemText: same array-item stringification as JSX (4-AREA RULE); ASCII ' - ' joiner for object items. */
const arrItemText = (item) => {
  if (item === null || item === undefined) return '';
  if (typeof item === 'object') return Object.values(item).filter(x => x !== null && x !== undefined && x !== '').map(String).join(' - ');
  return String(item);
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

/* sentenceRows: splitBySentence -> parseLabel -> splitByComma, decomposing a nested "Label: value"
   comma list into its own sub-label + item rows (mirrors the JSX; never side-by-side). */
const sentenceRows = (text) => {
  const rows = [];
  splitBySentence(text).forEach(sentence => {
    const p = parseLabel(sentence);
    if (p.isLabeled) {
      const items = splitByComma(p.value);
      if (items.length >= 2) {
        rows.push({ type: 'sub', text: p.label });
        items.forEach(it => rows.push({ type: 'item', text: it }));
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

/* fieldBody: arrays -> numbered verbatim items; numbers -> value; sentence/string -> sentenceRows
   (single value plain; multi-row list numbered). */
const fieldBody = (record, f) => {
  const v = record[f];
  if (ARRAY_FIELDS.includes(f)) {
    const items = (Array.isArray(v) ? v : []).map(arrItemText).filter(Boolean);
    return items.map((it, i) => <Text key={i} style={styles.value}>{i + 1}. {safeString(it)}</Text>);
  }
  if (NUMBER_FIELDS.includes(f)) return [<Text key="v" style={styles.value}>{safeString(String(v))}</Text>];
  const rows = sentenceRows(String(v));
  if (rows.length <= 1) {
    const only = rows[0];
    if (only && only.type === 'sub') return [<Text key="v" style={styles.subLabel}>{safeString(only.text)}</Text>];
    return [<Text key="v" style={styles.value}>{only ? strip(only.text) : safeString(String(v))}</Text>];
  }
  let n = 0;
  return rows.map((r, i) => r.type === 'sub'
    ? <Text key={i} style={styles.subLabel}>{safeString(r.text)}</Text>
    : <Text key={i} style={styles.value}>{++n}. {strip(r.text)}</Text>);
};

const fieldPresent = (record, f) => {
  const v = record[f];
  if (HIDE_ZERO_FIELDS.includes(f) && v === 0) return false;
  if (ARRAY_FIELDS.includes(f)) return Array.isArray(v) && v.some(item => arrItemText(item));
  return hasVal(v);
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

const PatientEducationContextDocumentPDFTemplate = ({ document: docProp, data = docProp }) => {
  let records = [];
  const src = data;
  if (Array.isArray(src)) records = src;
  else if (src && typeof src === 'object') {
    if (src.patient_education_context) records = Array.isArray(src.patient_education_context) ? src.patient_education_context : [src.patient_education_context];
    else if (src.documentData) { const dd = src.documentData; records = Array.isArray(dd) ? dd : [dd]; }
    else records = [src];
  }
  records = records.filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Patient Education Context</Text>
          <Text style={styles.noData}>No patient education context records available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Patient Education Context</Text>
        {records.map((record, rIdx) => {
          const recordNum = (record._originalIdx ?? rIdx) + 1;
          return (
            <View key={rIdx}>
              <Text style={styles.recordTitle} break={rIdx > 0}>{safeString(`Patient Education Context ${recordNum}`)}</Text>
              {hasVal(record.date) && <Text style={styles.recordDate}>{safeString(formatDate(record.date))}</Text>}
              {SECTION_ORDER.map(sid => renderSection(record, sid))}
            </View>
          );
        })}
        <Text style={styles.footer} fixed>This document contains Protected Health Information (PHI). Handle in accordance with HIPAA.</Text>
      </Page>
    </Document>
  );
};

export default PatientEducationContextDocumentPDFTemplate;
