import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * MedicationOptimizationDocumentPDFTemplate - box-free canonical (LETTER)
 * Config-driven from the JSX SECTION_ORDER/SECTION_TITLES/SECTION_FIELDS/FIELD_LABELS.
 * Mirrors the on-screen template: a LABEL is a bold heading on its own line; a VALUE is a plain
 * line below it (NEVER "Label: value" inline, NO numbering). Deeply-nested objects recurse;
 * arrays-of-objects render each item as its own atomic sub-block (first scalar field = sub-label,
 * remaining fields = label-above-value rows). hide-empty everywhere (numbers hide at 0).
 * No boxes: underline rules only (documentTitle 2 / recordTitle+sectionTitle 1 / fieldLabel 0.5).
 * Page-break (Rule #74): the sectionTitle + fieldLabel + first content block ride in ONE wrap={false}
 * header View (never orphaned); every remaining item/row is its own wrap={false} View so a long field
 * flows across pages between items — boolean wrap values only, never the unbreakable wrap=undefined idiom.
 * NO record date: the record has only createdAt/updatedAt (ingestion timestamps) — title only.
 */

const styles = StyleSheet.create({
  page: { padding: 40, paddingBottom: 64, fontFamily: 'Helvetica', fontSize: 14, backgroundColor: '#ffffff', color: '#000000', lineHeight: 1.4 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', marginBottom: 16, paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', marginTop: 14, marginBottom: 10, paddingBottom: 5, borderBottomWidth: 1, borderBottomColor: '#000000' },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginTop: 10, marginBottom: 6, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000' },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginTop: 6, marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  subLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginTop: 4, marginBottom: 2 },
  value: { fontSize: 14, paddingLeft: 8, marginBottom: 3, lineHeight: 1.4 },
  footer: { position: 'absolute', bottom: 24, left: 40, right: 40, fontSize: 9, color: '#666666', textAlign: 'center', borderTopWidth: 0.5, borderTopColor: '#cccccc', paddingTop: 6 },
  noData: { fontSize: 14, textAlign: 'center', marginTop: 40, color: '#666666' },
});

/* CONFIG (mirrors the JSX) */
const SECTION_ORDER = ['currentMeds', 'renalHepatic', 'interactions', 'therapeuticLevels', 'optimization', 'adherenceCost', 'pharmacogenomics'];
const SECTION_TITLES = {
  currentMeds: 'Current Medications',
  renalHepatic: 'Renal & Hepatic Function',
  interactions: 'Interactions & Duplicates',
  therapeuticLevels: 'Therapeutic Levels',
  optimization: 'Optimization & Deprescribing',
  adherenceCost: 'Adherence & Cost',
  pharmacogenomics: 'Pharmacogenomics & Monitoring',
};
const SECTION_FIELDS = {
  currentMeds: ['currentMedications', 'medicationAllergies'],
  renalHepatic: ['creatinineClearance', 'estimatedGFR', 'hepaticFunction'],
  interactions: ['drugInteractions', 'therapeuticDuplicates', 'cyp450Interactions', 'contraindications', 'beersListMedications'],
  therapeuticLevels: ['targetTherapeuticLevels', 'currentTherapeuticLevels'],
  optimization: ['dosageOptimization', 'deprescribingOpportunities', 'indicationAppropriatenessReview', 'medicationErrors'],
  adherenceCost: ['adherenceAssessment', 'medicationCostAnalysis', 'pillBurdenAssessment', 'formularyStatus'],
  pharmacogenomics: ['pharmacogeneticTesting', 'adverseEventMonitoring', 'medicationTimingOptimization'],
};
const NARRATIVE_FIELDS = new Set(['hepaticFunction', 'adherenceAssessment', 'medicationCostAnalysis', 'pharmacogeneticTesting', 'medicationTimingOptimization']);
const FIELD_LABELS = {
  currentMedications: 'Current Medications', medicationAllergies: 'Medication Allergies',
  creatinineClearance: 'Creatinine Clearance', estimatedGFR: 'Estimated GFR', hepaticFunction: 'Hepatic Function',
  drugInteractions: 'Drug Interactions', therapeuticDuplicates: 'Therapeutic Duplicates', cyp450Interactions: 'CYP450 Interactions', contraindications: 'Contraindications', beersListMedications: 'Beers List Medications',
  targetTherapeuticLevels: 'Target Therapeutic Levels', currentTherapeuticLevels: 'Current Therapeutic Levels',
  dosageOptimization: 'Dosage Optimization', deprescribingOpportunities: 'Deprescribing Opportunities', indicationAppropriatenessReview: 'Indication Appropriateness Review', medicationErrors: 'Medication Errors',
  adherenceAssessment: 'Adherence Assessment', medicationCostAnalysis: 'Medication Cost Analysis', pillBurdenAssessment: 'Pill Burden Assessment', formularyStatus: 'Formulary Status',
  pharmacogeneticTesting: 'Pharmacogenetic Testing', adverseEventMonitoring: 'Adverse Event Monitoring', medicationTimingOptimization: 'Medication Timing Optimization',
};
const KEY_OVERRIDES = { cyp450Interactions: 'CYP450 Interactions', estimatedGFR: 'Estimated GFR', gfr: 'GFR', abi: 'ABI', cyp2c19: 'CYP2C19', cyp2d6: 'CYP2D6', cyp2c9: 'CYP2C9' };

/* HELPERS (mirror the JSX) — safeString uses \uXXXX escapes ONLY (never literal smart-quotes/invisible chars) */
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
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key];
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const isEmptyDeep = (v) => {
  if (v === null || v === undefined) return true;
  if (typeof v === 'boolean') return false;
  if (typeof v === 'number') return !Number.isFinite(v) || v === 0;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0;
  if (typeof v === 'object') return Object.values(v).every(isEmptyDeep);
  return false;
};
const hasVal = (v) => !isEmptyDeep(v);
const isScalar = (v) => v === null || typeof v !== 'object';
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|[A-Z]))[.;](?:\s+)/).map(s => s.trim().replace(/^\d+\.\s+/, '')).filter(s => s && !/^[;.,!?]+$/.test(s));
};

/* recursive node → a FLAT array of elements. A label is a bold heading on its own line; a value is a
   plain line below. Array items each become their OWN atomic wrap={false} View so a long field can
   flow across pages between items. Never side-by-side. */
const nodeEls = (label, value, depth, keyBase) => {
  if (isEmptyDeep(value)) return [];
  const LabelStyle = depth > 0 ? styles.subLabel : styles.fieldLabel;
  if (isScalar(value)) {
    const els = [];
    if (label) els.push(<Text key={`${keyBase}-l`} style={LabelStyle}>{safeString(label)}</Text>);
    els.push(<Text key={`${keyBase}-v`} style={styles.value}>{safeString(fmtScalar(value))}</Text>);
    return els;
  }
  if (Array.isArray(value)) {
    const els = [];
    if (label) els.push(<Text key={`${keyBase}-l`} style={LabelStyle}>{safeString(label)}</Text>);
    value.filter(x => !isEmptyDeep(x)).forEach((item, i) => {
      if (isScalar(item)) { els.push(<Text key={`${keyBase}-${i}`} style={styles.value}>{safeString(fmtScalar(item))}</Text>); return; }
      const entries = Object.entries(item).filter(([, v]) => !isEmptyDeep(v));
      if (!entries.length) return;
      const headScalar = isScalar(entries[0][1]);
      const rest = headScalar ? entries.slice(1) : entries;
      const itemEls = [];
      if (headScalar) itemEls.push(<Text key="h" style={styles.subLabel}>{safeString(fmtScalar(entries[0][1]))}</Text>);
      rest.forEach(([k, v], j) => { itemEls.push(...nodeEls(humanizeKey(k), v, depth + 1, `${keyBase}-${i}-${j}`)); });
      els.push(<View key={`${keyBase}-${i}`} wrap={false}>{itemEls}</View>);
    });
    return els;
  }
  const els = [];
  if (label) els.push(<Text key={`${keyBase}-l`} style={LabelStyle}>{safeString(label)}</Text>);
  Object.entries(value).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => { els.push(...nodeEls(humanizeKey(k), v, depth + 1, `${keyBase}-${k}`)); });
  return els;
};

/* one top-level field: header (sectionTitle + fieldLabel + first block) is an atomic wrap={false} View;
   every remaining block is its own wrap={false} View so the field flows across pages between blocks. */
const renderField = (record, f, sectionTitle, isFirst) => {
  const val = record[f];
  if (isEmptyDeep(val)) return null;
  const label = FIELD_LABELS[f] || humanizeKey(f);
  const showLabel = label.trim().toLowerCase() !== (sectionTitle || '').trim().toLowerCase();
  let blocks;
  if (NARRATIVE_FIELDS.has(f) && typeof val === 'string') {
    const s = splitBySentence(val); const lines = s.length > 1 ? s : [String(val)];
    blocks = lines.map((ln, i) => <Text key={i} style={styles.value}>{safeString(ln)}</Text>);
  } else {
    blocks = nodeEls('', val, 0, f);
  }
  if (blocks.length === 0) return null;
  return (
    <View key={f}>
      <View wrap={false}>
        {isFirst ? <Text style={styles.sectionTitle}>{safeString(sectionTitle)}</Text> : null}
        {showLabel ? <Text style={styles.fieldLabel}>{safeString(label)}</Text> : null}
        {blocks[0]}
      </View>
      {blocks.slice(1).map((b, i) => <View key={`b${i}`} wrap={false}>{b}</View>)}
    </View>
  );
};

const renderSection = (record, sid) => {
  const fields = SECTION_FIELDS[sid] || [];
  const present = fields.filter(f => hasVal(record[f]));
  if (present.length === 0) return null;
  const sectionTitle = SECTION_TITLES[sid];
  return present.map((f, i) => renderField(record, f, sectionTitle, i === 0));
};

const MedicationOptimizationDocumentPDFTemplate = ({ document: docProp, data = docProp }) => {
  let records = [];
  if (Array.isArray(data)) records = data;
  else if (data?.medication_optimization) records = Array.isArray(data.medication_optimization) ? data.medication_optimization : [data.medication_optimization];
  else if (data?.documentData) { const dd = data.documentData; if (Array.isArray(dd)) records = dd; else if (dd?.medication_optimization) records = Array.isArray(dd.medication_optimization) ? dd.medication_optimization : [dd.medication_optimization]; else if (dd && typeof dd === 'object') records = [dd]; }
  else if (data && typeof data === 'object') records = [data];
  records = (records || []).filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Medication Optimization</Text>
          <Text style={styles.noData}>No medication optimization records available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Medication Optimization</Text>
        {records.map((record, rIdx) => (
          <View key={rIdx}>
            <Text style={styles.recordTitle} break={rIdx > 0}>{safeString(`Medication Optimization ${rIdx + 1}`)}</Text>
            {SECTION_ORDER.map(sid => renderSection(record, sid))}
          </View>
        ))}
        <Text style={styles.footer} fixed>This document contains Protected Health Information (PHI). Handle in accordance with HIPAA.</Text>
      </Page>
    </Document>
  );
};

export default MedicationOptimizationDocumentPDFTemplate;
