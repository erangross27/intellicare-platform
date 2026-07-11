/**
 * PerinatalMentalHealthReferralDocumentPDFTemplate.jsx
 * Box-free B&W LETTER (canonical, memory 6a2d6af6) — mirrors PerinatalMentalHealthReferralDocument.jsx.
 * Flat screening schema: booleans (Yes/No, false always shown), numbers (0/absent hidden unless a
 * meaningful-zero score, EPDS /30 · PHQ-9 /27 · GAD-7 /21 suffix), enums (title-cased dropdown value),
 * string arrays (numbered, hidden when empty), one free-text narrative (sentence-split). Single-name
 * label gate (a field label == its section title -> label hidden). No date field -> record header is
 * TITLE-ONLY "Perinatal Mental Health Referral N". Rule #74: every field is ONE wrap={false} atomic
 * View with the sectionTitle riding INSIDE the first present field's View. safeString uses \uXXXX
 * escapes only (no literal non-ASCII). Static PHI footer.
 * Collection: perinatal_mental_health_referral.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, paddingBottom: 64, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.4, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 16 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', textAlign: 'center', color: '#000000', paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000' },
  recordContainer: { marginBottom: 20 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 14, marginBottom: 10, paddingBottom: 5, borderBottomWidth: 1, borderBottomColor: '#000000' },
  section: { marginBottom: 12 },
  fieldGroup: { marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 10, marginBottom: 6, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000' },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  subLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 2 },
  value: { fontSize: 14, lineHeight: 1.4, color: '#000000', marginBottom: 3, paddingLeft: 8 },
  emptyState: { fontSize: 14, textAlign: 'center', marginTop: 40, color: '#666666' },
  footer: { position: 'absolute', bottom: 24, left: 40, right: 40, fontSize: 9, color: '#666666', textAlign: 'center', borderTopWidth: 0.5, borderTopColor: '#cccccc', paddingTop: 6 },
});

/* ======= CONFIG (mirrors the JSX) ======= */
const SECTION_ORDER = ['screening', 'risk', 'clinical', 'pregnancy-delivery', 'medications', 'referral'];

const SECTION_TITLES = {
  'screening': 'Screening Scores',
  'risk': 'Risk Assessment',
  'clinical': 'Clinical Context',
  'pregnancy-delivery': 'Pregnancy & Delivery',
  'medications': 'Current Psychotropic Medications',
  'referral': 'Referral',
};

const FIELD_LABELS = {
  edinburghPostnatalScore: 'Edinburgh Postnatal Depression Score',
  phq9Score: 'PHQ-9 Score',
  gad7Score: 'GAD-7 Score',
  gestationalAgeAtScreening: 'Gestational Age at Screening',
  weeksPostpartum: 'Weeks Postpartum',
  suicidalIdeationPresent: 'Suicidal Ideation Present',
  psychosisRiskFactors: 'Psychosis Risk Factors',
  previousPsychiatricHistory: 'Previous Psychiatric History',
  maternalBondingImpairment: 'Maternal Bonding Impairment',
  substanceUseHistory: 'Substance Use History',
  domesticViolenceScreening: 'Domestic Violence Screening',
  breastfeedingStatus: 'Breastfeeding Status',
  sleepDisturbanceLevel: 'Sleep Disturbance Level',
  appetiteChanges: 'Appetite Changes',
  socialSupportLevel: 'Social Support Level',
  infantMedicalIssues: 'Infant Medical Issues',
  pregnancyComplications: 'Pregnancy Complications',
  deliveryComplications: 'Delivery Complications',
  currentPsychotropicMedications: 'Current Psychotropic Medications',
  referralUrgencyLevel: 'Referral Urgency Level',
  requestedSpecialtyServices: 'Requested Specialty Services',
};

const SECTION_FIELDS = {
  'screening': ['edinburghPostnatalScore', 'phq9Score', 'gad7Score', 'gestationalAgeAtScreening', 'weeksPostpartum'],
  'risk': ['suicidalIdeationPresent', 'psychosisRiskFactors', 'previousPsychiatricHistory', 'maternalBondingImpairment', 'substanceUseHistory', 'domesticViolenceScreening'],
  'clinical': ['breastfeedingStatus', 'sleepDisturbanceLevel', 'appetiteChanges', 'socialSupportLevel', 'infantMedicalIssues'],
  'pregnancy-delivery': ['pregnancyComplications', 'deliveryComplications'],
  'medications': ['currentPsychotropicMedications'],
  'referral': ['referralUrgencyLevel', 'requestedSpecialtyServices'],
};

const BOOLEAN_FIELDS = ['suicidalIdeationPresent', 'previousPsychiatricHistory', 'maternalBondingImpairment', 'psychosisRiskFactors', 'substanceUseHistory', 'infantMedicalIssues'];
const NUMBER_FIELDS = ['edinburghPostnatalScore', 'gestationalAgeAtScreening', 'weeksPostpartum', 'phq9Score', 'gad7Score'];
// MEANINGFUL_ZERO_FIELDS: numerics where 0 is a valid clinical finding (EPDS/PHQ-9/GAD-7 0 = no symptoms;
// weeksPostpartum 0 = delivery day). gestationalAgeAtScreening 0 = N/A sentinel (excluded). Mirrors JSX.
const MEANINGFUL_ZERO_FIELDS = ['edinburghPostnatalScore', 'phq9Score', 'gad7Score', 'weeksPostpartum'];
const ENUM_FIELDS = ['breastfeedingStatus', 'sleepDisturbanceLevel', 'appetiteChanges', 'socialSupportLevel', 'referralUrgencyLevel'];
const ARRAY_FIELDS = ['currentPsychotropicMedications', 'pregnancyComplications', 'deliveryComplications', 'requestedSpecialtyServices'];

const SCORE_SUFFIX = {
  edinburghPostnatalScore: '/30',
  phq9Score: '/27',
  gad7Score: '/21',
};

/* ======= HELPERS ======= */
const hasNumber = (fn, v) => {
  if (v === null || v === undefined || v === '') return false;
  const n = Number(v);
  if (!Number.isFinite(n)) return false;
  if (n === 0) return MEANINGFUL_ZERO_FIELDS.includes(fn);
  return true;
};
const isBoolPresent = (v) => (typeof v === 'boolean' || v === 'true' || v === 'false');
const hasArray = (v) => Array.isArray(v) && v.filter(x => x !== null && x !== undefined && String(x).trim() !== '').length > 0;
const hasString = (v) => {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') return v.trim() !== '';
  if (typeof v === 'number') return v !== 0;
  return String(v).trim() !== '';
};
const fieldHasVal = (fn, v) => {
  if (BOOLEAN_FIELDS.includes(fn)) return isBoolPresent(v);
  if (NUMBER_FIELDS.includes(fn)) return hasNumber(fn, v);
  if (ARRAY_FIELDS.includes(fn)) return hasArray(v);
  return hasString(v);
};

const boolDisplay = (v) => ((v === true || v === 'true') ? 'Yes' : 'No');

// enumCanonical: title-case the stored value ('exclusive breastfeeding' -> 'Exclusive Breastfeeding').
const enumCanonical = (v) => {
  const s = String(v == null ? '' : v).trim();
  if (!s) return '';
  return s.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
};

/* safeString: \uXXXX escapes ONLY — never paste literal smart-quotes / dashes / invisible chars. */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'number' ? String(val) : typeof val === 'boolean' ? (val ? 'Yes' : 'No') : String(val);
  return str
    .replace(/[\u2018\u2019\u201B]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/[\u00B5\u03BC]m/g, 'um')
    .replace(/[\u00B5\u03BC]g/g, 'mcg')
    .replace(/[\u00B5\u03BC]/g, 'u')
    .replace(/\u00B0/g, ' deg')
    .replace(/\u00B1/g, '+/-')
    .replace(/\u2265/g, '>=')
    .replace(/\u2264/g, '<=')
    .replace(/\u2192/g, '->')
    .replace(/[\u00D7\u2715\u2716]/g, 'x')
    .replace(/\u00F7/g, '/')
    .replace(/\u00A0/g, ' ')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u2028\u2029\uFEFF]/g, '');
};

const CLAUSE_OPENER = /^(if|when|while|unless|although|though|because|since|after|before|once|given|whether|should|as|until|provided|assuming|in case)\b/i;
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m && !CLAUSE_OPENER.test(m[1].trim())) return { isLabeled: true, label: m[1].trim(), value: m[2].trim().replace(/^\d+\.\s+/, '') };
  return { isLabeled: false, label: '', value: text };
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|[A-Z]))[.;](?:\s+)/).map(s => s.trim().replace(/^\d+\.\s+/, '')).filter(s => s && !/^[;.,!?]+$/.test(s));
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

/* Top-level value -> rows for one field (box-free text). */
const fieldBody = (fn, val) => {
  if (BOOLEAN_FIELDS.includes(fn)) return [<Text key="b" style={styles.value}>{boolDisplay(val)}</Text>];
  if (NUMBER_FIELDS.includes(fn)) { const suffix = SCORE_SUFFIX[fn] || ''; return [<Text key="n" style={styles.value}>{`${safeString(val)}${suffix}`}</Text>]; }
  if (ENUM_FIELDS.includes(fn)) return [<Text key="e" style={styles.value}>{safeString(enumCanonical(val))}</Text>];
  if (ARRAY_FIELDS.includes(fn)) {
    const items = Array.isArray(val) ? val.filter(x => x !== null && x !== undefined && String(x).trim() !== '') : [];
    return items.map((it, i) => <Text key={i} style={styles.value}>{i + 1}. {safeString(it)}</Text>);
  }
  /* Free-text narrative string */
  const strVal = safeString(val);
  const rows = sentenceRows(strVal);
  if (rows.length <= 1) return [<Text key="v" style={styles.value}>{strVal}</Text>];
  return rows.map((r, i) => r.type === 'sub'
    ? <Text key={i} style={styles.subLabel}>{safeString(r.text)}</Text>
    : <Text key={i} style={styles.value}>{strip(r.text)}</Text>);
};

/* One field = ONE wrap={false} atomic View; sectionTitle rides inside the first present field. */
const renderField = (record, fn, sectionTitle, isFirst) => {
  const val = record[fn];
  if (!fieldHasVal(fn, val)) return null;
  const label = FIELD_LABELS[fn] || fn;
  const showLabel = label.trim().toLowerCase() !== (sectionTitle || '').trim().toLowerCase();
  return (
    <View key={fn} style={styles.fieldGroup} wrap={false}>
      {isFirst && <Text style={styles.sectionTitle}>{safeString(sectionTitle)}</Text>}
      {showLabel && <Text style={styles.fieldLabel}>{safeString(label)}</Text>}
      {fieldBody(fn, val)}
    </View>
  );
};

const renderSection = (record, sid) => {
  const fields = SECTION_FIELDS[sid] || [];
  const present = fields.filter(f => fieldHasVal(f, record[f]));
  if (present.length === 0) return null;
  const title = SECTION_TITLES[sid];
  return (
    <View key={sid} style={styles.section}>
      {present.map((f, i) => renderField(record, f, title, i === 0))}
    </View>
  );
};

/* ======= MAIN COMPONENT ======= */
const PerinatalMentalHealthReferralDocumentPDFTemplate = ({ document: docProp, data: dataProp }) => {
  const data = docProp || dataProp;
  let rawRecords = [];
  if (Array.isArray(data)) {
    rawRecords = data.flatMap(item => {
      if (item?.perinatal_mental_health_referral) return Array.isArray(item.perinatal_mental_health_referral) ? item.perinatal_mental_health_referral : [item.perinatal_mental_health_referral];
      if (item?.documentData) { const dd = item.documentData; if (Array.isArray(dd)) return dd; if (dd?.perinatal_mental_health_referral) return Array.isArray(dd.perinatal_mental_health_referral) ? dd.perinatal_mental_health_referral : [dd.perinatal_mental_health_referral]; return [dd]; }
      return [item];
    });
  } else if (data?.perinatal_mental_health_referral) {
    rawRecords = Array.isArray(data.perinatal_mental_health_referral) ? data.perinatal_mental_health_referral : [data.perinatal_mental_health_referral];
  } else if (data?.documentData) {
    const dd = data.documentData;
    if (Array.isArray(dd)) rawRecords = dd;
    else if (dd?.perinatal_mental_health_referral) rawRecords = Array.isArray(dd.perinatal_mental_health_referral) ? dd.perinatal_mental_health_referral : [dd.perinatal_mental_health_referral];
    else if (dd && typeof dd === 'object') rawRecords = [dd];
  } else if (data) {
    rawRecords = [data];
  }
  const records = rawRecords.filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}><Text style={styles.documentTitle}>Perinatal Mental Health Referral</Text></View>
          <Text style={styles.emptyState}>No perinatal mental health referral records available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Perinatal Mental Health Referral</Text></View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <Text style={styles.recordTitle}>{safeString(`Perinatal Mental Health Referral ${idx + 1}`)}</Text>
            {SECTION_ORDER.map(sid => renderSection(record, sid))}
          </View>
        ))}
        <Text style={styles.footer} fixed>This document contains Protected Health Information (PHI). Handle in accordance with HIPAA.</Text>
      </Page>
    </Document>
  );
};

export default PerinatalMentalHealthReferralDocumentPDFTemplate;
