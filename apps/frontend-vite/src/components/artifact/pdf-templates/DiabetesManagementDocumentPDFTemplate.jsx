/**
 * DiabetesManagementDocumentPDFTemplate.jsx
 * July 2026 — Helvetica — LETTER — BLACK & WHITE only (#000000 titles/values, #999999 label rules).
 * Collection: diabetes_management.
 *
 * BOX-FREE canonical: page 14 / title 26 / recordTitle 19 / sectionTitle 16 + 1pt black rule /
 * fieldLabel & subLabel 13 + 0.5pt #999 rule / values 14.
 * Rule #74: wrap is BOOLEAN only; the section title rides INSIDE the first glue unit; every
 * sub-label glues with its first row. Every value row numbered ("1." even singles).
 * Mirrors the JSX exactly: per-field sentinel zeros hidden (episode counts + weightChange 0
 * stay), object fields (lipidPanel/cgmData/insulinRegimen/targets) recurse into ruled
 * sub-labels, [.;] sentence split with guarded comma sub-split.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 24, paddingBottom: 14, borderBottomWidth: 2, borderBottomColor: '#000000' },
  title: { fontSize: 26, fontFamily: 'Helvetica-Bold', textAlign: 'center', color: '#000000' },
  recordContainer: { paddingBottom: 8 },
  recordHeader: { marginBottom: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000' },
  section: { marginBottom: 16 },
  fieldGroup: { marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000' },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 4, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  subLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  value: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#000000' },
});

/* ═══ UTILS ═══ */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  let str = typeof val === 'string' ? val : String(val);
  str = str.replace(/µm/g, 'um').replace(/μm/g, 'um').replace(/°/g, ' deg')
    .replace(/±/g, '+/-').replace(/≥/g, '>=').replace(/≤/g, '<=')
    .replace(/→/g, '->').replace(/“/g, '"').replace(/”/g, '"')
    .replace(/‘/g, "'").replace(/’/g, "'").replace(/—/g, '-').replace(/–/g, '-');
  return str;
};

const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try {
    const d = new Date(dateValue.$date || dateValue);
    if (isNaN(d.getTime())) return String(dateValue);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return String(dateValue); }
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|approx|no|No|i\.e|e\.g))[.;](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
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
      const rest = text.slice(i + 1);
      const nextTrim = rest.trimStart();
      const noSpace = rest.charAt(0) !== ' ';
      const andOr = /(?:^|\s)(?:and|or)$/i.test(current.trimEnd()) || /^(?:and|or)\b/i.test(nextTrim);
      const badNext = !/^[A-Za-z>(]/.test(nextTrim.charAt(0) || '');
      if (noSpace || andOr || badNext) { current += ch; }
      else { const t = current.trim(); if (t) result.push(t); current = ''; }
    }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

const humanizeKey = (key) => {
  if (!key || typeof key !== 'string') return String(key || '');
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

/* Sentence rows mirroring the JSX/copy: labeled groups restart numbering under a sub-label;
   unlabeled comma lists (>=3 guarded parts) and plain sentences continue the running count. */
const sentenceRows = (text) => {
  const rows = []; let running = 1;
  splitBySentence(text).forEach(s => {
    const parsed = parseLabel(s);
    const value = (parsed.isLabeled ? parsed.value : s).replace(/[;.]+$/, '').trim();
    if (!value) return;
    const parts = splitByComma(value);
    if (parsed.isLabeled) {
      rows.push({ subLabel: parsed.label });
      if (parts.length >= 3) parts.forEach((item, i) => rows.push({ num: i + 1, text: item }));
      else rows.push({ num: 1, text: value });
    } else if (parts.length >= 3) {
      parts.forEach(item => rows.push({ num: running++, text: item }));
    } else {
      rows.push({ num: running++, text: value });
    }
  });
  return rows;
};

/* Recursive object rows: every key is a labeled sub-group (restart numbering). */
const objectRows = (obj) => {
  const rows = [];
  Object.entries(obj).filter(([, v]) => hasVal(v)).forEach(([k, v]) => {
    rows.push({ subLabel: humanizeKey(k) });
    if (v && typeof v === 'object' && !Array.isArray(v)) rows.push(...objectRows(v));
    else if (Array.isArray(v)) v.filter(x => hasVal(x)).forEach((item, i) => rows.push({ num: i + 1, text: fmtVal(item) }));
    else rows.push({ num: 1, text: fmtVal(v) });
  });
  return rows;
};

/* Group rows into glue units: a sub-label glues with its first row; plain rows stand alone.
   The section title rides inside the FIRST unit. */
const RowsSection = ({ title, rows }) => {
  if (!rows || rows.length === 0) return null;
  const units = [];
  rows.forEach(r => {
    if (r.subLabel !== undefined) { units.push({ label: r.subLabel, rows: [] }); return; }
    const last = units[units.length - 1];
    if (last && last.label !== null && last.rows.length === 0) { last.rows.push(r); return; }
    units.push({ label: null, rows: [r] });
  });
  return (
    <View style={styles.section}>
      {units.map((u, i) => (
        <View key={i} wrap={false} style={styles.fieldGroup}>
          {i === 0 && <Text style={styles.sectionTitle}>{title}</Text>}
          {u.label !== null && <Text style={styles.subLabel}>{safeString(u.label)}</Text>}
          {u.rows.map((r, ri) => <Text key={ri} style={styles.value}>{`${r.num}. ${safeString(r.text)}`}</Text>)}
        </View>
      ))}
    </View>
  );
};

const fieldRows = (label, lines) => {
  const out = [{ subLabel: label }];
  lines.forEach((l, i) => out.push({ num: i + 1, text: l }));
  return out;
};

/* mirrors the JSX sentinel semantics */
const HIDE_ZERO_FIELDS = ['hba1cValue', 'fastingGlucose', 'randomGlucose', 'targetHba1c', 'basalInsulinDose', 'correctionFactor', 'timeInRange', 'glucoseVariability', 'urineAlbuminCreatinineRatio', 'estimatedGfr', 'bodyMassIndex'];
const fieldShows = (fn, v) => hasVal(v) && !(typeof v === 'number' && v === 0 && HIDE_ZERO_FIELDS.includes(fn));

/* ═══ COMPONENT ═══ */
const DiabetesManagementDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.diabetes_management) return Array.isArray(r.diabetes_management) ? r.diabetes_management : [r.diabetes_management];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.diabetes_management) return Array.isArray(dd.diabetes_management) ? dd.diabetes_management : [dd.diabetes_management]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (
      <Document title="Diabetes Management">
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}><Text style={styles.title}>Diabetes Management</Text></View>
          <Text style={styles.emptyState}>No records available</Text>
        </Page>
      </Document>
    );
  }

  /* Build one section's rows from a field spec: [fieldName, label, kind]
     kind: 'date' | 'number' | 'boolean' | 'sentence' | 'array' | 'object' | 'text' */
  const buildRows = (record, spec) => {
    const rows = [];
    spec.forEach(([f, label, kind]) => {
      const v = record[f];
      if (!fieldShows(f, v)) return;
      if (kind === 'date') rows.push(...fieldRows(label, [formatDate(v)]));
      else if (kind === 'boolean') { if (v !== null && v !== undefined) rows.push(...fieldRows(label, [v ? 'Yes' : 'No'])); }
      else if (kind === 'number') rows.push(...fieldRows(label, [String(v)]));
      else if (kind === 'sentence') { rows.push({ subLabel: label }); sentenceRows(fmtVal(v)).forEach(r => rows.push(r)); }
      else if (kind === 'array') { if (Array.isArray(v) && v.length) { rows.push({ subLabel: label }); v.filter(x => hasVal(x)).forEach((item, i) => rows.push({ num: i + 1, text: String(item) })); } }
      else if (kind === 'object') { if (v && typeof v === 'object' && !Array.isArray(v) && hasVal(v)) { rows.push({ subLabel: label }); rows.push(...objectRows(v)); } }
      else rows.push(...fieldRows(label, [fmtVal(v)]));
    });
    return rows;
  };

  return (
    <Document title="Diabetes Management">
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Diabetes Management</Text></View>

        {records.map((record, idx) => {
          const meds = Array.isArray(record.currentMedications) ? record.currentMedications.filter(m => hasVal(m)) : [];
          return (
            <View key={idx} style={styles.recordContainer} break={idx > 0}>
              <View style={styles.recordHeader} wrap={false}>
                <Text style={styles.recordTitle}>{`Diabetes Management ${idx + 1}`}</Text>
              </View>

              <RowsSection title="Session Information" rows={buildRows(record, [
                ['date', 'Date', 'date'], ['provider', 'Provider', 'text'], ['facility', 'Facility', 'text'],
              ])} />
              <RowsSection title="Diabetes Overview" rows={buildRows(record, [
                ['diabetesType', 'Diabetes Type', 'text'], ['diagnosisDate', 'Diagnosis Date', 'date'],
              ])} />
              <RowsSection title="Glycemic Control" rows={buildRows(record, [
                ['hba1cValue', 'HbA1c Value (%)', 'number'], ['hba1cDate', 'HbA1c Date', 'date'],
                ['fastingGlucose', 'Fasting Glucose', 'number'], ['randomGlucose', 'Random Glucose', 'number'],
                ['targetHba1c', 'Target HbA1c (%)', 'number'],
                ['targetFastingGlucose', 'Target Fasting Glucose', 'object'], ['targetPostprandialGlucose', 'Target Postprandial Glucose', 'object'],
                ['lipidPanel', 'Lipid Panel', 'object'],
              ])} />
              {meds.length > 0 && <RowsSection title="Medications" rows={[{ subLabel: 'Current Medications' }, ...meds.map((m, i) => ({ num: i + 1, text: String(m) }))]} />}
              {/* single-name rule: the insulinRegimen label matches the section title → its keys render directly */}
              <RowsSection title="Insulin Regimen" rows={[
                ...((record.insulinRegimen && typeof record.insulinRegimen === 'object' && !Array.isArray(record.insulinRegimen) && hasVal(record.insulinRegimen)) ? objectRows(record.insulinRegimen) : []),
                ...buildRows(record, [
                  ['basalInsulinDose', 'Basal Insulin Dose', 'number'],
                  ['bolusInsulinRatio', 'Bolus Insulin Ratio', 'text'], ['correctionFactor', 'Correction Factor', 'number'],
                ]),
              ]} />
              <RowsSection title="Glucose Monitoring" rows={buildRows(record, [
                ['glucoseMonitoringMethod', 'Monitoring Method', 'text'], ['cgmData', 'CGM Data', 'object'],
                ['timeInRange', 'Time in Range (%)', 'number'], ['glucoseVariability', 'Glucose Variability (%)', 'number'],
              ])} />
              <RowsSection title="Hypoglycemia & Hyperglycemia" rows={buildRows(record, [
                ['hypoglycemicEpisodes', 'Hypoglycemic Episodes', 'number'], ['severeHypoglycemiaHistory', 'Severe Hypoglycemia History', 'boolean'],
                ['hyperglycemicEpisodes', 'Hyperglycemic Episodes', 'number'], ['diabeticKetoacidosisHistory', 'DKA History', 'boolean'],
              ])} />
              <RowsSection title="Complications" rows={buildRows(record, [
                ['diabeticRetinopathy', 'Diabetic Retinopathy', 'sentence'], ['lastEyeExamDate', 'Last Eye Exam Date', 'date'],
                ['diabeticNephropathy', 'Diabetic Nephropathy', 'text'], ['urineAlbuminCreatinineRatio', 'Urine Albumin/Creatinine Ratio', 'number'],
                ['estimatedGfr', 'Estimated GFR', 'number'], ['diabeticNeuropathy', 'Diabetic Neuropathy', 'text'],
              ])} />
              <RowsSection title="Cardiovascular & Body Composition" rows={buildRows(record, [
                ['cardiovascularDisease', 'Cardiovascular Disease', 'sentence'], ['bloodPressure', 'Blood Pressure', 'text'],
                ['statinTherapy', 'Statin Therapy', 'boolean'], ['bodyMassIndex', 'BMI', 'number'], ['weightChange', 'Weight Change', 'number'],
              ])} />
              <RowsSection title="Foot Examination" rows={buildRows(record, [
                ['footExamCompleted', 'Foot Exam Completed', 'boolean'], ['peripheralPulses', 'Peripheral Pulses', 'sentence'],
              ])} />
              <RowsSection title="Lifestyle & Follow-up" rows={buildRows(record, [
                ['diabetesEducation', 'Diabetes Education', 'sentence'], ['nutritionCounseling', 'Nutrition Counseling', 'boolean'],
                ['physicalActivityLevel', 'Physical Activity Level', 'text'], ['smokingStatus', 'Smoking Status', 'text'],
                ['nextFollowUpDate', 'Next Follow-up Date', 'date'],
              ])} />
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default DiabetesManagementDocumentPDFTemplate;
