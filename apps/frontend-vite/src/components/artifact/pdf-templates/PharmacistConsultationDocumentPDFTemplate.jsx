/**
 * PharmacistConsultationDocumentPDFTemplate.jsx
 * Box-free B&W LETTER (canonical, memory 6a2d6af6) -- mirrors PharmacistConsultationDocument.jsx.
 * Flat pharmacist-consultation schema: dates (medicationTherapyManagementDate / nextMTMFollowUpDate),
 * numeric counts/scores, Yes/No booleans, string arrays (interventions / cost-savings / interaction
 * flags), and one narrative string (cytochromeP450InteractionRisk). Number 0 is a "not recorded"
 * sentinel (CrCl/INR/TTR/Morisky) -> hidden, mirroring the JSX hasVal. Labeled array items
 * ("Total annual savings: $32,232") decompose to sub-label + value (never side-by-side). Narrative
 * strings use [.;] sentence-split (abbrev/single-initial guard, thousands-guarded comma-split,
 * CLAUSE_OPENER). Single-name label gate (field label == section title -> label hidden;
 * pharmacistInterventionsMade). Rule #74: every field is ONE wrap={false} atomic View with the
 * sectionTitle riding INSIDE the first present field's View. safeString uses \uXXXX escapes only.
 * Collection: pharmacist_consultation.
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
const SECTION_ORDER = [
  'consultation-overview', 'adherence-assessment', 'drug-interactions-safety',
  'dosing-pharmacokinetics', 'immunization-review', 'adverse-reactions',
  'pharmacist-interventions', 'cost-savings-followup',
];

const SECTION_TITLES = {
  'consultation-overview': 'Consultation Overview',
  'adherence-assessment': 'Adherence Assessment',
  'drug-interactions-safety': 'Drug Interactions & Safety',
  'dosing-pharmacokinetics': 'Dosing & Pharmacokinetics',
  'immunization-review': 'Immunization Review',
  'adverse-reactions': 'Adverse Reactions',
  'pharmacist-interventions': 'Pharmacist Interventions',
  'cost-savings-followup': 'Cost Savings & Follow-Up',
};

const FIELD_LABELS = {
  medicationTherapyManagementDate: 'MTM Date',
  currentMedicationCount: 'Current Medication Count',
  polypharmacyRiskScore: 'Polypharmacy Risk Score',
  medicationReconciliationCompleted: 'Medication Reconciliation Completed',
  discrepanciesIdentifiedCount: 'Discrepancies Identified',
  medicationAdherenceRate: 'Medication Adherence Rate',
  morisky8ItemScoreMMAS: 'Morisky 8-Item Score (MMAS)',
  drugDrugInteractionsIdentified: 'Drug-Drug Interactions',
  drugDiseaseContraindicationsNoted: 'Drug-Disease Contraindications',
  therapeuticDuplicationFlags: 'Therapeutic Duplication Flags',
  beersListMedicationsPresent: 'Beers List Medications',
  stopp_startCriteriaViolations: 'STOPP/START Criteria Violations',
  creatinineClearanceCalculated: 'Creatinine Clearance',
  renalDoseAdjustmentsRequired: 'Renal Dose Adjustments',
  hepaticDoseAdjustmentsRequired: 'Hepatic Dose Adjustments',
  cytochromeP450InteractionRisk: 'Cytochrome P450 Interaction Risk',
  narrowTherapeuticIndexDrugs: 'Narrow Therapeutic Index Drugs',
  internationalNormalizedRatioINR: 'INR',
  anticoagulationTimeInTherapeuticRange: 'Time in Therapeutic Range',
  immunizationStatusReviewed: 'Immunization Status Reviewed',
  vaccinesAdministered: 'Vaccines Administered',
  adverseDrugReactionHistory: 'Adverse Drug Reactions',
  pharmacistInterventionsMade: 'Pharmacist Interventions',
  costSavingsOpportunitiesIdentified: 'Cost Savings Opportunities',
  nextMTMFollowUpDate: 'Next MTM Follow-Up Date',
};

const SECTION_FIELDS = {
  'consultation-overview': ['medicationTherapyManagementDate', 'currentMedicationCount', 'polypharmacyRiskScore', 'medicationReconciliationCompleted', 'discrepanciesIdentifiedCount'],
  'adherence-assessment': ['medicationAdherenceRate', 'morisky8ItemScoreMMAS'],
  'drug-interactions-safety': ['drugDrugInteractionsIdentified', 'drugDiseaseContraindicationsNoted', 'therapeuticDuplicationFlags', 'beersListMedicationsPresent', 'stopp_startCriteriaViolations'],
  'dosing-pharmacokinetics': ['creatinineClearanceCalculated', 'renalDoseAdjustmentsRequired', 'hepaticDoseAdjustmentsRequired', 'cytochromeP450InteractionRisk', 'narrowTherapeuticIndexDrugs', 'internationalNormalizedRatioINR', 'anticoagulationTimeInTherapeuticRange'],
  'immunization-review': ['immunizationStatusReviewed', 'vaccinesAdministered'],
  'adverse-reactions': ['adverseDrugReactionHistory'],
  'pharmacist-interventions': ['pharmacistInterventionsMade'],
  'cost-savings-followup': ['costSavingsOpportunitiesIdentified', 'nextMTMFollowUpDate'],
};

const DATE_FIELDS = ['medicationTherapyManagementDate', 'nextMTMFollowUpDate'];
const ARRAY_FIELDS = ['drugDrugInteractionsIdentified', 'drugDiseaseContraindicationsNoted', 'therapeuticDuplicationFlags', 'beersListMedicationsPresent', 'stopp_startCriteriaViolations', 'renalDoseAdjustmentsRequired', 'hepaticDoseAdjustmentsRequired', 'narrowTherapeuticIndexDrugs', 'vaccinesAdministered', 'adverseDrugReactionHistory', 'pharmacistInterventionsMade', 'costSavingsOpportunitiesIdentified'];

/* ======= HELPERS ======= */
// number 0 is a "not recorded" sentinel here -> treated as empty (mirrors the JSX hasVal).
const isEmptyDeep = (v) => {
  if (v === null || v === undefined) return true;
  if (typeof v === 'boolean') return false;
  if (typeof v === 'number') return v === 0 || !Number.isFinite(v);
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0;
  if (typeof v === 'object') return Object.values(v).every(isEmptyDeep);
  return false;
};
const hasVal = (v) => !isEmptyDeep(v);
const isScalar = (v) => v === null || typeof v !== 'object';
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); if (isNaN(d.getTime())) return String(dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};

/* safeString: \uXXXX escapes ONLY -- never paste literal smart-quotes / dashes / invisible chars. */
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

/* Top-level value -> rows for one field. */
const fieldBody = (field, val) => {
  if (DATE_FIELDS.includes(field)) return [<Text key="d" style={styles.value}>{safeString(formatDate(val))}</Text>];
  if (ARRAY_FIELDS.includes(field) || Array.isArray(val)) {
    const items = (Array.isArray(val) ? val : [val]).filter(hasVal);
    const out = []; let n = 1;
    items.forEach((it, i) => {
      if (isScalar(it)) {
        const p = parseLabel(String(it));
        if (p.isLabeled) {
          out.push(<Text key={'s' + i} style={styles.subLabel}>{safeString(p.label)}</Text>);
          out.push(<Text key={'v' + i} style={styles.value}>{n++}. {safeString(p.value)}</Text>);
        } else {
          out.push(<Text key={i} style={styles.value}>{n++}. {safeString(fmtScalar(it))}</Text>);
        }
      }
    });
    return out;
  }
  if (typeof val === 'string') {
    const rows = sentenceRows(val);
    if (rows.length === 0) return [<Text key="v" style={styles.value}>{safeString(val)}</Text>];
    return rows.map((r, i) => r.type === 'sub'
      ? <Text key={i} style={styles.subLabel}>{safeString(r.text)}</Text>
      : <Text key={i} style={styles.value}>{strip(r.text)}</Text>);
  }
  return [<Text key="v" style={styles.value}>{safeString(fmtScalar(val))}</Text>];
};

const renderField = (record, field, sectionTitle, isFirst) => {
  const val = record[field];
  if (!hasVal(val)) return null;
  const label = FIELD_LABELS[field] || field;
  const showLabel = label.trim().toLowerCase() !== (sectionTitle || '').trim().toLowerCase();
  return (
    <View key={field} style={styles.fieldGroup} wrap={false}>
      {isFirst && <Text style={styles.sectionTitle}>{safeString(sectionTitle)}</Text>}
      {showLabel && <Text style={styles.fieldLabel}>{safeString(label)}</Text>}
      {fieldBody(field, val)}
    </View>
  );
};

const renderSection = (record, sid) => {
  const fields = SECTION_FIELDS[sid] || [];
  const present = fields.filter(f => hasVal(record[f]));
  if (present.length === 0) return null;
  const title = SECTION_TITLES[sid];
  return (
    <View key={sid} style={styles.section}>
      {present.map((f, i) => renderField(record, f, title, i === 0))}
    </View>
  );
};

const PharmacistConsultationDocumentPDFTemplate = ({ document: docProp, data: dataProp }) => {
  const data = docProp || dataProp;
  let rawRecords = [];
  if (Array.isArray(data)) {
    rawRecords = data.flatMap(item => {
      if (item?.pharmacist_consultation) return Array.isArray(item.pharmacist_consultation) ? item.pharmacist_consultation : [item.pharmacist_consultation];
      if (item?.documentData) { const dd = item.documentData; if (Array.isArray(dd)) return dd; if (dd?.pharmacist_consultation) return Array.isArray(dd.pharmacist_consultation) ? dd.pharmacist_consultation : [dd.pharmacist_consultation]; return [dd]; }
      return [item];
    });
  } else if (data?.pharmacist_consultation) {
    rawRecords = Array.isArray(data.pharmacist_consultation) ? data.pharmacist_consultation : [data.pharmacist_consultation];
  } else if (data?.documentData) {
    const dd = data.documentData;
    if (Array.isArray(dd)) rawRecords = dd;
    else if (dd?.pharmacist_consultation) rawRecords = Array.isArray(dd.pharmacist_consultation) ? dd.pharmacist_consultation : [dd.pharmacist_consultation];
    else if (dd && typeof dd === 'object') rawRecords = [dd];
  } else if (data) {
    rawRecords = [data];
  }
  const records = rawRecords.filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}><Text style={styles.documentTitle}>Pharmacist Consultation</Text></View>
          <Text style={styles.emptyState}>No pharmacist consultation records available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Pharmacist Consultation</Text></View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <Text style={styles.recordTitle}>{safeString(`Pharmacist Consultation ${idx + 1}`)}</Text>
            {SECTION_ORDER.map(sid => renderSection(record, sid))}
          </View>
        ))}
        <Text style={styles.footer} fixed>This document contains Protected Health Information (PHI). Handle in accordance with HIPAA.</Text>
      </Page>
    </Document>
  );
};

export default PharmacistConsultationDocumentPDFTemplate;
