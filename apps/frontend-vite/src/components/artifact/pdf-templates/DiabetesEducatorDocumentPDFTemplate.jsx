/**
 * DiabetesEducatorDocumentPDFTemplate.jsx
 * July 2026 — Helvetica — LETTER — BLACK & WHITE only (#000000 titles/values, #999999 label rules).
 * Collection: diabetes_educator.
 *
 * BOX-FREE canonical: page 14 / title 26 / recordTitle 19 / sectionTitle 16 + 1pt black rule /
 * fieldLabel & subLabel 13 + 0.5pt #999 rule / values 14.
 * Rule #74: wrap is BOOLEAN only; the section title rides INSIDE the first glue unit; every
 * sub-label glues with its first row. Every value row numbered ("1." even singles).
 * Mirrors the JSX exactly: dynamic bloodGlucoseTargets/complicationsScreening keys, Basal/Bolus
 * insulin groups, [.;] sentence split with guarded comma sub-split (labeled groups restart
 * numbering, unlabeled rows run on), string arrays numbered, single-name labels hidden.
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
  if (!key) return '';
  if (key === String(key).toUpperCase()) return key; // acronyms (TIR, UACR)
  const spaced = String(key)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();
  return spaced.replace(/\b\w/g, c => c.toUpperCase());
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

/* field rows helper: sub-label per field (restart numbering) */
const fieldRows = (label, lines) => {
  const out = [{ subLabel: label }];
  lines.forEach((l, i) => out.push({ num: i + 1, text: l }));
  return out;
};

/* ═══ COMPONENT ═══ */
const DiabetesEducatorDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.diabetes_educator) return Array.isArray(r.diabetes_educator) ? r.diabetes_educator : [r.diabetes_educator];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.diabetes_educator) return Array.isArray(dd.diabetes_educator) ? dd.diabetes_educator : [dd.diabetes_educator]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (
      <Document title="Diabetes Educator">
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}><Text style={styles.title}>Diabetes Educator</Text></View>
          <Text style={styles.emptyState}>No records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document title="Diabetes Educator">
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Diabetes Educator</Text></View>

        {records.map((record, idx) => {
          /* Session Information */
          const sessionRows = [];
          if (hasVal(record.date)) sessionRows.push(...fieldRows('Date', [formatDate(record.date)]));
          if (hasVal(record.provider)) sessionRows.push(...fieldRows('Provider', [fmtVal(record.provider)]));
          if (hasVal(record.facility)) sessionRows.push(...fieldRows('Facility', [fmtVal(record.facility)]));
          if (hasVal(record.sessionType)) sessionRows.push(...fieldRows('Session Type', [fmtVal(record.sessionType)]));

          /* Diabetes Overview — A1c 0 = extractor sentinel, hidden */
          const overviewRows = [];
          if (hasVal(record.diabetesType)) overviewRows.push(...fieldRows('Diabetes Type', [fmtVal(record.diabetesType)]));
          if (hasVal(record.diagnosisDate)) overviewRows.push(...fieldRows('Diagnosis Date', [formatDate(record.diagnosisDate)]));
          if (hasVal(record.currentA1c) && record.currentA1c !== 0) overviewRows.push(...fieldRows('Current A1c', [String(record.currentA1c)]));
          if (hasVal(record.targetA1c) && record.targetA1c !== 0) overviewRows.push(...fieldRows('Target A1c', [String(record.targetA1c)]));

          const meds = Array.isArray(record.currentMedications) ? record.currentMedications.filter(m => hasVal(m)) : [];

          /* Insulin Regimen — flat labeled leaves, mirrors the JSX Basal/Bolus grouping */
          const insulinRows = [];
          const ir = record.insulinRegimen || {};
          [['basal', 'Basal'], ['bolus', 'Bolus']].forEach(([grp, gLabel]) => {
            const obj = ir[grp] || {};
            Object.entries(obj).filter(([, v]) => hasVal(v)).forEach(([k, v]) => {
              insulinRows.push(...fieldRows(`${gLabel} ${humanizeKey(k)}`, [fmtVal(v)]));
            });
          });

          /* Glucose Targets & Monitoring — dynamic keys */
          const glucoseRows = [];
          const bg = record.bloodGlucoseTargets || {};
          Object.entries(bg).filter(([, v]) => hasVal(v)).forEach(([k, v]) => {
            glucoseRows.push(...fieldRows(humanizeKey(k), [fmtVal(v)]));
          });
          if (hasVal(record.selfMonitoringFrequency)) {
            glucoseRows.push({ subLabel: 'Self-Monitoring Frequency' });
            sentenceRows(fmtVal(record.selfMonitoringFrequency)).forEach(r => glucoseRows.push(r));
          }

          /* Hypoglycemia */
          const hypoRows = [];
          if (hasVal(record.hypoglycemiaHistory)) { hypoRows.push({ subLabel: 'Hypoglycemia History' }); sentenceRows(fmtVal(record.hypoglycemiaHistory)).forEach(r => hypoRows.push(r)); }
          if (hasVal(record.hypoglycemiaTreatment)) { hypoRows.push({ subLabel: 'Hypoglycemia Treatment' }); sentenceRows(fmtVal(record.hypoglycemiaTreatment)).forEach(r => hypoRows.push(r)); }

          /* Nutrition */
          const nutritionRows = [];
          if (hasVal(record.carbohydrateCounting)) { nutritionRows.push({ subLabel: 'Carbohydrate Counting' }); sentenceRows(fmtVal(record.carbohydrateCounting)).forEach(r => nutritionRows.push(r)); }
          if (hasVal(record.mealPlanType)) nutritionRows.push(...fieldRows('Meal Plan Type', [fmtVal(record.mealPlanType)]));
          const goals = Array.isArray(record.nutritionGoals) ? record.nutritionGoals.filter(g => hasVal(g)) : [];
          if (goals.length > 0) { nutritionRows.push({ subLabel: 'Nutrition Goals' }); goals.forEach((g, i) => nutritionRows.push({ num: i + 1, text: String(g) })); }

          /* Physical Activity */
          const activityRows = hasVal(record.physicalActivityPlan)
            ? [{ subLabel: 'Physical Activity Plan' }, ...sentenceRows(fmtVal(record.physicalActivityPlan))] : [];

          /* Foot Care */
          const footRows = [];
          if (record.footExamPerformed !== null && record.footExamPerformed !== undefined) footRows.push(...fieldRows('Foot Exam Performed', [record.footExamPerformed ? 'Yes' : 'No']));
          if (hasVal(record.footCareKnowledge)) { footRows.push({ subLabel: 'Foot Care Knowledge' }); sentenceRows(fmtVal(record.footCareKnowledge)).forEach(r => footRows.push(r)); }

          /* Complications Screening — dynamic keys */
          const compRows = [];
          const comp = record.complicationsScreening || {};
          Object.entries(comp).filter(([, v]) => hasVal(v)).forEach(([k, v]) => {
            compRows.push(...fieldRows(humanizeKey(k), [fmtVal(v)]));
          });

          const barriers = Array.isArray(record.psychosocialBarriers) ? record.psychosocialBarriers.filter(b => hasVal(b)) : [];
          const tech = Array.isArray(record.technologyUsed) ? record.technologyUsed.filter(t => hasVal(t)) : [];

          const sickRows = hasVal(record.sickDayManagement) ? sentenceRows(fmtVal(record.sickDayManagement)) : [];

          /* Next Steps */
          const nextRows = [];
          if (hasVal(record.nextEducationTopic)) {
            nextRows.push({ subLabel: 'Next Education Topic' });
            const items = splitByComma(fmtVal(record.nextEducationTopic));
            if (items.length >= 3) items.forEach((item, i) => nextRows.push({ num: i + 1, text: item }));
            else nextRows.push({ num: 1, text: fmtVal(record.nextEducationTopic) });
          }

          return (
            <View key={idx} style={styles.recordContainer} break={idx > 0}>
              <View style={styles.recordHeader} wrap={false}>
                <Text style={styles.recordTitle}>{`Diabetes Educator ${idx + 1}`}</Text>
              </View>

              <RowsSection title="Session Information" rows={sessionRows} />
              <RowsSection title="Diabetes Overview" rows={overviewRows} />
              {meds.length > 0 && <RowsSection title="Current Medications" rows={meds.map((m, i) => ({ num: i + 1, text: String(m) }))} />}
              <RowsSection title="Insulin Regimen" rows={insulinRows} />
              <RowsSection title="Glucose Targets & Monitoring" rows={glucoseRows} />
              <RowsSection title="Hypoglycemia" rows={hypoRows} />
              <RowsSection title="Nutrition" rows={nutritionRows} />
              <RowsSection title="Physical Activity" rows={activityRows} />
              <RowsSection title="Foot Care" rows={footRows} />
              <RowsSection title="Complications Screening" rows={compRows} />
              {barriers.length > 0 && <RowsSection title="Psychosocial Barriers" rows={barriers.map((b, i) => ({ num: i + 1, text: String(b) }))} />}
              {tech.length > 0 && <RowsSection title="Technology" rows={[{ subLabel: 'Technology Used' }, ...tech.map((t, i) => ({ num: i + 1, text: String(t) }))]} />}
              <RowsSection title="Sick Day Management" rows={sickRows} />
              <RowsSection title="Next Steps" rows={nextRows} />
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default DiabetesEducatorDocumentPDFTemplate;
