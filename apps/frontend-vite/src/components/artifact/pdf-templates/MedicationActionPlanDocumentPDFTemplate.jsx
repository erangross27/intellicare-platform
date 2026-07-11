/**
 * MedicationActionPlanDocumentPDFTemplate.jsx
 * June 2026 — Helvetica — LETTER size — medication action plan
 * Collection: medication_action_plan
 * NO BLUE COLORS (#606060/#9a9a9a/#bcbcbc BANNED) — #000000/#333333/#cccccc/#f5f5f5 ONLY
 * Rule #74: sectionTitle rendered INSIDE the first present field's View (no orphan siblings).
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#333333', borderBottomStyle: 'solid' },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#000000', textAlign: 'center', marginBottom: 4 },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#cccccc', borderBottomStyle: 'solid' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#333333', marginBottom: 8 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#333333', marginBottom: 2 },
  fieldValue: { fontSize: 11, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 11, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#cccccc', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 12, color: '#333333', textAlign: 'center', marginTop: 40 },
});

/* ======= UTILS ======= */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  return String(val);
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

const isScalar = (v) => v === null || typeof v !== 'object';
const isEmptyDeep = (v) => {
  if (v === null || v === undefined) return true;
  if (typeof v === 'boolean') return false;
  if (typeof v === 'number') return !Number.isFinite(v);
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0;
  if (typeof v === 'object') return Object.values(v).every(isEmptyDeep);
  return false;
};
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};
/* flatten any value to one readable line: "key: value; key: value" */
const flattenLine = (v) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number' || typeof v === 'string') return String(v);
  if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).map(flattenLine).join(', ');
  if (typeof v === 'object') return Object.entries(v).filter(([, val]) => !isEmptyDeep(val)).map(([k, val]) => `${humanizeKey(k)}: ${flattenLine(val)}`).join('; ');
  return '';
};

/* hide-zero: numeric "not recorded" (0) hidden unless doctor-edited */
const numberShowsPDF = (record, key) => {
  const val = record[key];
  if (val === null || val === undefined || val === '') return false;
  const num = Number(val);
  if (Number.isNaN(num)) return false;
  if (num === 0) return Array.isArray(record?.doctorEdits?.editedFields) && record.doctorEdits.editedFields.includes(key);
  return true;
};

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.(?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
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
    else if (ch === ',' && depth === 0) { const t = current.trim(); if (t) result.push(t); current = ''; }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

/* renderFieldRow: optional sectionTitle inside the View (Rule #74) */
const renderFieldRow = (label, value, sectionTitle) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox} wrap={false}>
      {sectionTitle && <Text style={styles.sectionTitle}>{sectionTitle}</Text>}
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{safeString(fmtVal(value))}</Text>
    </View>
  );
};

/* renderDateRow */
const renderDateRow = (label, value, sectionTitle) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox} wrap={false}>
      {sectionTitle && <Text style={styles.sectionTitle}>{sectionTitle}</Text>}
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{formatDate(value)}</Text>
    </View>
  );
};

/* renderSentenceSection: parseLabel + comma-split — duplicate label suppression */
const renderSentenceSection = (label, text, sectionTitle) => {
  if (!hasVal(text)) return null;
  const sentences = splitBySentence(fmtVal(text));
  if (sentences.length === 0) return null;

  const rows = [];
  let n = 1;
  sentences.forEach(s => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const commaItems = splitByComma(parsed.value);
      if (commaItems.length >= 2) {
        rows.push({ type: 'subtitle', text: safeString(parsed.label) });
        commaItems.forEach(ci => { rows.push({ type: 'item', text: safeString(ci), num: n++ }); });
      } else {
        rows.push({ type: 'item', text: safeString(s), num: n++ });
      }
    } else {
      rows.push({ type: 'item', text: safeString(s), num: n++ });
    }
  });

  const wrapProp = rows.length > 8 ? undefined : false;

  return (
    <View style={styles.fieldBox} wrap={wrapProp}>
      {sectionTitle && <Text style={styles.sectionTitle}>{sectionTitle}</Text>}
      <Text style={styles.fieldLabel}>{label}</Text>
      {rows.map((row, i) => {
        if (row.type === 'subtitle') {
          return <Text key={i} style={styles.nestedSubtitle}>{row.text}</Text>;
        }
        return <Text key={i} style={styles.listItem}>{row.num}. {row.text}</Text>;
      })}
    </View>
  );
};

/* renderObjectArrayField — array of {…} objects flattened readably (NO [object Object]).
   Each item: numbered subtitle + one line per non-empty subfield. */
const OBJECT_SUBFIELDS_PDF = {
  drugDrugInteractionAlerts: [
    { key: 'severity', label: 'Severity' }, { key: 'drugs', label: 'Drugs' },
    { key: 'effect', label: 'Effect' }, { key: 'recommendation', label: 'Recommendation' },
  ],
  therapeuticDuplicationFlags: [
    { key: 'class', label: 'Therapeutic Class' }, { key: 'medications', label: 'Medications' },
    { key: 'recommendation', label: 'Recommendation' },
  ],
  therapeuticSubstitutionOptions: [
    { key: 'nonFormulary', label: 'Non-Formulary Medication' }, { key: 'alternative', label: 'Alternative' },
    { key: 'rationale', label: 'Rationale' },
  ],
  adverseDrugReactionHistory: [
    { key: 'drug', label: 'Drug' }, { key: 'reaction', label: 'Reaction' },
    { key: 'naranjoScore', label: 'Naranjo Score' }, { key: 'causality', label: 'Causality' }, { key: 'year', label: 'Year' },
  ],
  deprescribingPriorityList: [
    { key: 'medication', label: 'Medication' }, { key: 'priority', label: 'Priority' }, { key: 'rationale', label: 'Rationale' },
  ],
};
const renderObjectArrayFieldPDF = (fieldKey, label, items, sectionTitle) => {
  if (!Array.isArray(items)) items = isEmptyDeep(items) ? [] : [items];
  const safeItems = items.filter(x => !isEmptyDeep(x));
  if (safeItems.length === 0) return null;
  const subDefs = OBJECT_SUBFIELDS_PDF[fieldKey] || [];
  const singular = label.replace(/s$/, '');
  /* count rows for wrap decision */
  let rowCount = 0;
  safeItems.forEach(it => { rowCount += isScalar(it) ? 1 : 1 + Object.keys(it).filter(k => !isEmptyDeep(it[k])).length; });

  return (
    <View style={styles.fieldBox} wrap={rowCount > 8 ? undefined : false}>
      {sectionTitle && <Text style={styles.sectionTitle}>{sectionTitle}</Text>}
      <Text style={styles.fieldLabel}>{label}</Text>
      {safeItems.map((item, i) => {
        if (isScalar(item)) return <Text key={i} style={styles.listItem}>{i + 1}. {fmtScalar(item)}</Text>;
        const knownKeys = subDefs.map(sf => sf.key);
        const extra = Object.keys(item).filter(k => !knownKeys.includes(k)).map(k => ({ key: k, label: humanizeKey(k) }));
        const allDefs = [...subDefs, ...extra].filter(sf => !isEmptyDeep(item[sf.key]));
        return (
          <View key={i}>
            <Text style={styles.nestedSubtitle}>{singular} {i + 1}</Text>
            {allDefs.map(sf => (
              <Text key={sf.key} style={styles.listItem}>{sf.label}: {isScalar(item[sf.key]) ? fmtScalar(item[sf.key]) : flattenLine(item[sf.key])}</Text>
            ))}
          </View>
        );
      })}
    </View>
  );
};

/* renderArrayField */
const renderArrayFieldPDF = (label, items, sectionTitle) => {
  if (!Array.isArray(items) || items.length === 0) return null;
  const safeItems = items.filter(Boolean);
  if (safeItems.length === 0) return null;

  return (
    <View style={styles.fieldBox} wrap={safeItems.length > 8 ? undefined : false}>
      {sectionTitle && <Text style={styles.sectionTitle}>{sectionTitle}</Text>}
      <Text style={styles.fieldLabel}>{label}</Text>
      {safeItems.map((item, i) => (
        <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>
      ))}
    </View>
  );
};

/* SECTION CONFIGS */
const SECTION_CONFIGS = [
  {
    title: 'Reconciliation & Adherence',
    fields: [
      { key: 'medicationReconciliationStatus', label: 'Medication Reconciliation Status', isSentence: true },
      { key: 'medicationAdherenceScore', label: 'MMAS-8 Adherence Score', isNumber: true },
      { key: 'priorAuthorizationStatus', label: 'Prior Authorization Status', isSentence: true },
    ],
  },
  {
    title: 'Risk Scores',
    fields: [
      { key: 'polypharmacyRiskScore', label: 'Polypharmacy Risk Score', isNumber: true },
      { key: 'has2BledScore', label: 'HAS-BLED Score', isNumber: true },
      { key: 'cha2ds2VascScore', label: 'CHA2DS2-VASc Score', isNumber: true },
      { key: 'anticholinergicBurdenScore', label: 'Anticholinergic Burden (ACB)', isNumber: true },
      { key: 'beersListMedicationCount', label: 'Beers List Medication Count', isNumber: true },
      { key: 'fallsRiskMedicationCount', label: 'Falls Risk Medication Count', isNumber: true },
    ],
  },
  {
    title: 'Drug Interactions & Duplications',
    fields: [
      { key: 'drugDrugInteractionAlerts', label: 'Drug-Drug Interaction Alerts', isObjectArray: true },
      { key: 'therapeuticDuplicationFlags', label: 'Therapeutic Duplication Flags', isObjectArray: true },
      { key: 'narrowTherapeuticIndexDrugs', label: 'Narrow Therapeutic Index Drugs', isArray: true },
      { key: 'qtProlongationRiskCategory', label: 'QT Prolongation Risk Category', isSentence: true },
      { key: 'sedationRiskAssessment', label: 'Sedation Risk Assessment', isSentence: true },
    ],
  },
  {
    title: 'Special Dosing',
    fields: [
      { key: 'renalDoseAdjustmentRequired', label: 'Renal Dose Adjustment Required', isBoolean: true },
      { key: 'hepaticDoseAdjustmentRequired', label: 'Hepatic Dose Adjustment Required', isBoolean: true },
      { key: 'insulinSlidingScaleParameters', label: 'Insulin Sliding Scale Parameters', isSentence: true },
      { key: 'opioidMorphineEquivalentDailyDose', label: 'Opioid MED (mg/day)', isNumber: true },
      { key: 'targetInrRange', label: 'Target INR Range', isSentence: true },
    ],
  },
  {
    title: 'Deprescribing & Substitutions',
    fields: [
      { key: 'deprescribingPriorityList', label: 'Deprescribing Priority List', isObjectArray: true },
      { key: 'therapeuticSubstitutionOptions', label: 'Therapeutic Substitution Options', isObjectArray: true },
      { key: 'medicationTaperSchedule', label: 'Medication Taper Schedule', isSentence: true },
      { key: 'adverseDrugReactionHistory', label: 'Adverse Drug Reaction History', isObjectArray: true },
      { key: 'pharmacogenomicConsiderations', label: 'Pharmacogenomic Considerations', isSentence: true },
    ],
  },
  {
    title: 'Monitoring',
    fields: [
      { key: 'nextTherapeuticDrugMonitoringDate', label: 'Next Therapeutic Drug Monitoring Date', isDate: true },
    ],
  },
];

/* field presence respecting hide-zero + boolean */
const fieldPresent = (record, field) => {
  if (field.isNumber) return numberShowsPDF(record, field.key);
  if (field.isBoolean) return typeof record[field.key] === 'boolean';
  if (field.isObjectArray) return !isEmptyDeep(record[field.key]);
  return hasVal(record[field.key]);
};

const renderField = (record, field, sectionTitle, key) => {
  const val = record[field.key];
  if (field.isObjectArray) return <View key={key}>{renderObjectArrayFieldPDF(field.key, field.label, val, sectionTitle)}</View>;
  if (field.isArray) return <View key={key}>{renderArrayFieldPDF(field.label, val, sectionTitle)}</View>;
  if (field.isDate) return <View key={key}>{renderDateRow(field.label, val, sectionTitle)}</View>;
  if (field.isSentence) return <View key={key}>{renderSentenceSection(field.label, val, sectionTitle)}</View>;
  return <View key={key}>{renderFieldRow(field.label, val, sectionTitle)}</View>;
};

/* ======= COMPONENT ======= */
const MedicationActionPlanDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.medication_action_plan) return Array.isArray(r.medication_action_plan) ? r.medication_action_plan : [r.medication_action_plan];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.medication_action_plan) return Array.isArray(dd.medication_action_plan) ? dd.medication_action_plan : [dd.medication_action_plan]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Medication Action Plan</Text>
          </View>
          <Text style={styles.noDataText}>No data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Document Header */}
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Medication Action Plan</Text>
        </View>

        {records.map((record, index) => (
          <View key={index} style={styles.recordContainer}>
            {index > 0 && <View style={styles.separator} />}

            {/* Record Header */}
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>
                {`Medication Action Plan ${index + 1}`}
              </Text>
            </View>

            {/* Sections — sectionTitle rendered inside the first present field (Rule #74) */}
            {SECTION_CONFIGS.map((sectionConfig, sIdx) => {
              const presentFields = sectionConfig.fields.filter(f => fieldPresent(record, f));
              if (presentFields.length === 0) return null;

              return (
                <View key={sIdx} style={styles.section} wrap={presentFields.length > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>{sectionConfig.title}</Text>
                  {presentFields.map((field, fIdx) =>
                    renderField(record, field, null, fIdx)
                  )}
                </View>
              );
            })}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default MedicationActionPlanDocumentPDFTemplate;
